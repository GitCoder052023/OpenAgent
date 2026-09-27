/**
 * Jarvis Bridge Harness Runner
 * Headless, direct execution channel to OpenCode's proven core tools.
 * Receives JSON-RPC requests on stdin, runs the tool, and responds on stdout.
 */
import readline from "node:readline"
import path from "node:path"
import fs from "node:fs/promises"
import { existsSync, statSync } from "node:fs"
import { spawn } from "node:child_process"
import { createTwoFilesPatch } from "diff"

interface ToolRequest {
  id: string | number
  tool: "bash" | "read" | "write" | "edit" | "grep" | "glob" | "system_info"
  args: Record<string, any>
}

interface ToolResponse {
  id: string | number
  status: "ok" | "error"
  result?: any
  error?: string
}

const MAX_OUTPUT_BYTES = 512 * 1024 // 512KB cap for shell/file outputs

function truncateOutput(text: string, maxBytes = MAX_OUTPUT_BYTES): { output: string; truncated: boolean } {
  const buf = Buffer.from(text, "utf-8")
  if (buf.length <= maxBytes) {
    return { output: text, truncated: false }
  }
  const slice = buf.subarray(0, maxBytes).toString("utf-8")
  return {
    output: slice + `\n\n... [Output truncated at ${maxBytes} bytes]`,
    truncated: true,
  }
}

// 1. BASH TOOL
async function executeBash(args: { command: string; cwd?: string; timeout_ms?: number }): Promise<any> {
  const { command, cwd = process.cwd(), timeout_ms = 60000 } = args
  const resolvedCwd = path.resolve(cwd)

  return new Promise((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false

    const proc = spawn("/bin/zsh", ["-c", command], {
      cwd: resolvedCwd,
      env: { ...process.env, PAGER: "cat" },
      detached: true,
    })

    const timer = setTimeout(() => {
      timedOut = true
      try {
        if (proc.pid) process.kill(-proc.pid, "SIGKILL")
      } catch {
        proc.kill("SIGKILL")
      }
    }, timeout_ms)

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8")
      if (stdout.length > MAX_OUTPUT_BYTES * 2) {
        try {
          if (proc.pid) process.kill(-proc.pid, "SIGKILL")
        } catch {
          proc.kill("SIGKILL")
        }
      }
    })

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8")
    })

    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })

    proc.on("close", (code) => {
      clearTimeout(timer)
      const combined = stdout + (stderr ? (stdout ? "\n" : "") + stderr : "")
      const { output, truncated } = truncateOutput(combined)

      resolve({
        exit_code: code,
        output,
        timed_out: timedOut,
        truncated,
        cwd: resolvedCwd,
      })
    })
  })
}

// 2. READ TOOL
async function executeRead(args: { path: string; offset?: number; limit?: number }): Promise<any> {
  const targetPath = path.resolve(args.path)
  if (!existsSync(targetPath)) {
    throw new Error(`Path does not exist: ${targetPath}`)
  }

  const stat = statSync(targetPath)
  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true })
    const list = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : e.isFile() ? "file" : "other",
    }))
    const offset = Math.max(1, args.offset ?? 1)
    const limit = args.limit ?? 100
    const sliced = list.slice(offset - 1, offset - 1 + limit)
    return {
      type: "directory",
      path: targetPath,
      total_entries: list.length,
      offset,
      limit,
      entries: sliced,
    }
  }

  const content = await fs.readFile(targetPath, "utf-8")
  const lines = content.split("\n")
  const totalLines = lines.length

  if (args.offset !== undefined || args.limit !== undefined) {
    const offset = Math.max(1, args.offset ?? 1)
    const limit = args.limit ?? 200
    const slice = lines.slice(offset - 1, offset - 1 + limit)
    return {
      type: "file",
      path: targetPath,
      total_lines: totalLines,
      offset,
      limit,
      content: slice.join("\n"),
    }
  }

  const { output, truncated } = truncateOutput(content)
  return {
    type: "file",
    path: targetPath,
    total_lines: totalLines,
    truncated,
    content: output,
  }
}

// 3. WRITE TOOL
async function executeWrite(args: { path: string; content: string }): Promise<any> {
  const targetPath = path.resolve(args.path)
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(targetPath, args.content, "utf-8")
  return {
    path: targetPath,
    bytes_written: Buffer.byteLength(args.content, "utf-8"),
    status: "written",
  }
}

// 4. EDIT TOOL (Exact Chunk Replace + Diff)
async function executeEdit(args: {
  path: string
  oldString: string
  newString: string
  replaceAll?: boolean
}): Promise<any> {
  const targetPath = path.resolve(args.path)
  if (!existsSync(targetPath)) {
    throw new Error(`File does not exist: ${targetPath}`)
  }

  const original = await fs.readFile(targetPath, "utf-8")
  const hasCRLF = original.includes("\r\n")
  const normalized = original.replaceAll("\r\n", "\n")
  const oldNorm = args.oldString.replaceAll("\r\n", "\n")
  const newNorm = args.newString.replaceAll("\r\n", "\n")

  if (oldNorm === newNorm) {
    throw new Error("newString must be different from oldString")
  }

  const occurrences = normalized.split(oldNorm).length - 1
  if (occurrences === 0) {
    throw new Error(`Target oldString not found in file: ${targetPath}`)
  }
  if (occurrences > 1 && !args.replaceAll) {
    throw new Error(
      `oldString matched ${occurrences} times in file. Provide more surrounding context lines or pass replaceAll: true.`,
    )
  }

  let replaced = ""
  if (args.replaceAll) {
    replaced = normalized.replaceAll(oldNorm, newNorm)
  } else {
    const idx = normalized.indexOf(oldNorm)
    replaced = normalized.slice(0, idx) + newNorm + normalized.slice(idx + oldNorm.length)
  }

  const finalOutput = hasCRLF ? replaced.replaceAll("\n", "\r\n") : replaced
  await fs.writeFile(targetPath, finalOutput, "utf-8")

  const diff = createTwoFilesPatch(targetPath, targetPath, normalized, replaced, "original", "modified")

  return {
    path: targetPath,
    replacements: occurrences,
    diff,
  }
}

// 5. GREP TOOL (Ripgrep)
async function executeGrep(args: { pattern: string; path?: string; include?: string }): Promise<any> {
  const searchPath = path.resolve(args.path ?? ".")
  const cmdArgs = ["--json", "-e", args.pattern]
  if (args.include) {
    cmdArgs.push("-g", args.include)
  }
  cmdArgs.push(searchPath)

  return new Promise((resolve, reject) => {
    const proc = spawn("rg", cmdArgs)
    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8")
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8")
    })

    proc.on("error", (err) => {
      // Fallback to git grep or zsh grep if rg is not in PATH
      resolve({
        pattern: args.pattern,
        error: `rg execution error: ${err.message}. Ensure ripgrep is installed.`,
        matches: [],
      })
    })

    proc.on("close", (code) => {
      const matches: Array<{ file: string; line: number; text: string }> = []
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === "match") {
            matches.push({
              file: parsed.data.path.text,
              line: parsed.data.line_number,
              text: parsed.data.lines.text.trimEnd(),
            })
            if (matches.length >= 100) break // cap at 100 matches
          }
        } catch {
          // non-json line
        }
      }
      resolve({
        pattern: args.pattern,
        total_matches: matches.length,
        matches,
      })
    })
  })
}

// 6. GLOB TOOL
async function executeGlob(args: { pattern: string; path?: string }): Promise<any> {
  const base = path.resolve(args.path ?? ".")
  // Using find or zsh glob
  const proc = spawn("/bin/zsh", ["-c", `setopt null_glob; ls -d ${args.pattern}`], {
    cwd: base,
  })
  return new Promise((resolve) => {
    let stdout = ""
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8")
    })
    proc.on("close", () => {
      const files = stdout
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean)
      resolve({
        pattern: args.pattern,
        base,
        matches: files,
      })
    })
  })
}

// 7. SYSTEM INFO
function executeSystemInfo(): any {
  return {
    platform: process.platform,
    arch: process.arch,
    node_version: process.version,
    cwd: process.cwd(),
    user: process.env.USER,
    home: process.env.HOME,
  }
}

// Router
async function handleRequest(req: ToolRequest): Promise<ToolResponse> {
  try {
    let result: any
    switch (req.tool) {
      case "bash":
        result = await executeBash(req.args as any)
        break
      case "read":
        result = await executeRead(req.args as any)
        break
      case "write":
        result = await executeWrite(req.args as any)
        break
      case "edit":
        result = await executeEdit(req.args as any)
        break
      case "grep":
        result = await executeGrep(req.args as any)
        break
      case "glob":
        result = await executeGlob(req.args as any)
        break
      case "system_info":
        result = executeSystemInfo()
        break
      default:
        throw new Error(`Unknown tool: ${(req as any).tool}`)
    }
    return { id: req.id, status: "ok", result }
  } catch (err: any) {
    return { id: req.id, status: "error", error: err.message || String(err) }
  }
}

// Stdio JSON-RPC Loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

rl.on("line", async (line) => {
  if (!line.trim()) return
  try {
    const req = JSON.parse(line) as ToolRequest
    const res = await handleRequest(req)
    process.stdout.write(JSON.stringify(res) + "\n")
  } catch (err: any) {
    process.stdout.write(
      JSON.stringify({
        id: "unknown",
        status: "error",
        error: `Invalid JSON payload: ${err.message}`,
      }) + "\n",
    )
  }
})

// Ready signal on stderr so stdout remains 100% pure JSON
process.stderr.write("[Jarvis OpenCode Harness] Ready on stdio IPC\n")
