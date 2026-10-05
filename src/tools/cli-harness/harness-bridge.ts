/**
 * OpenAgent Harness Runner
 * Headless, direct execution channel to OpenCode's proven core tools.
 * Receives JSON-RPC requests on stdin, runs the tool, and responds on stdout.
 */
import readline from "node:readline"
import path from "node:path"
import fs from "node:fs/promises"
import { existsSync, statSync, createReadStream } from "node:fs"
import { spawn } from "node:child_process"
import { createTwoFilesPatch } from "diff"

// Preserved OpenCode agent intelligence & system context
import { loadSystemInstructions } from "./packages/opencode/src/session/instruction"
import { provider, environment } from "./packages/opencode/src/session/system"
import { BuiltinAgents } from "./packages/opencode/src/agent/agent"

interface ToolRequest {
  id: string | number
  tool:
    | "bash"
    | "read"
    | "write"
    | "edit"
    | "grep"
    | "glob"
    | "system_info"
    | "instructions"
    | "system_prompt"
    | "applescript"
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
  if (!existsSync(resolvedCwd) || !statSync(resolvedCwd).isDirectory()) {
    throw new Error(`Working directory does not exist: ${resolvedCwd}`)
  }

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

// 2. READ TOOL (Streaming, line-bounded and byte-bounded with fuzzy path suggestion)
async function executeRead(args: { path: string; offset?: number; limit?: number }): Promise<any> {
  const targetPath = path.resolve(args.path)
  if (!existsSync(targetPath)) {
    const dir = path.dirname(targetPath)
    const base = path.basename(targetPath)
    let suggestion = ""
    try {
      const entries = await fs.readdir(dir)
      const matches = entries
        .filter(
          (e) =>
            e.toLowerCase().includes(base.toLowerCase()) ||
            base.toLowerCase().includes(e.toLowerCase()),
        )
        .slice(0, 3)
      if (matches.length > 0) {
        suggestion = `\n\nDid you mean one of these?\n${matches.map((m) => path.join(dir, m)).join("\n")}`
      }
    } catch {
      // directory unreadable
    }
    throw new Error(`Path does not exist: ${targetPath}${suggestion}`)
  }

  const stat = statSync(targetPath)
  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true })
    const sorted = entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        name: e.isDirectory() ? e.name + "/" : e.name,
        type: e.isDirectory() ? "directory" : e.isFile() ? "file" : "other",
      }))
    const offset = Math.max(1, args.offset ?? 1)
    const limit = args.limit ?? 100
    const sliced = sorted.slice(offset - 1, offset - 1 + limit)
    return {
      type: "directory",
      path: targetPath,
      total_entries: sorted.length,
      offset,
      limit,
      truncated: offset - 1 + limit < sorted.length,
      entries: sliced,
    }
  }

  // Prevent reading binary files into text
  const ext = path.extname(targetPath).toLowerCase()
  const BINARY_EXTS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".m4a", ".mp3", ".wav", ".ogg", ".flac",
    ".zip", ".tar", ".gz", ".7z", ".bz2", ".xz",
    ".pdf", ".bin", ".dylib", ".so", ".exe", ".dmg", ".pkg", ".pyc"
  ])
  if (BINARY_EXTS.has(ext)) {
    throw new Error(`Cannot read binary file: ${targetPath}`)
  }

  // Stream lines to prevent high memory allocation on large files
  const offset = Math.max(1, args.offset ?? 1)
  const limit = args.limit ?? 2000
  const lines: string[] = []
  let currentLine = 0
  let truncated = false
  let bytesAccumulated = 0

  const fileStream = createReadStream(targetPath, { encoding: "utf-8" })
  const lineReader = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  for await (const line of lineReader) {
    currentLine++
    if (currentLine < offset) continue
    if (lines.length >= limit) {
      truncated = true
      break
    }
    bytesAccumulated += Buffer.byteLength(line, "utf-8")
    if (bytesAccumulated > MAX_OUTPUT_BYTES) {
      truncated = true
      lines.push(`\n... [Output truncated at ${MAX_OUTPUT_BYTES} bytes]`)
      break
    }
    lines.push(line)
  }

  fileStream.destroy()
  lineReader.close()

  return {
    type: "file",
    path: targetPath,
    offset,
    limit,
    lines_returned: lines.length,
    truncated,
    content: lines.join("\n"),
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

  if (!args.oldString) {
    throw new Error("oldString cannot be empty")
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

// 5. GREP TOOL (Ripgrep with argument isolation and regex error detection from OpenCode ripgrep.ts)
async function executeGrep(args: { pattern: string; path?: string; include?: string }): Promise<any> {
  if (!args.pattern) {
    throw new Error("Search pattern cannot be empty")
  }
  const searchPath = path.resolve(args.path ?? ".")
  if (!existsSync(searchPath)) {
    throw new Error(`Path does not exist: ${searchPath}`)
  }
  const cmdArgs = [
    "--no-config",
    "--json",
    "--hidden",
    "--no-messages",
    ...(args.include ? [`--glob=${args.include}`] : []),
    "--glob=!**/.git/**",
    "--glob=!**/node_modules/**",
    "--",
    args.pattern,
    searchPath,
  ]

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

    proc.on("error", (err: any) => {
      resolve({
        pattern: args.pattern,
        error: `Ripgrep execution error: ${err.message}. Ensure ripgrep is installed.`,
        matches: [],
      })
    })

    proc.on("close", (code) => {
      if (
        code === 2 &&
        (stderr.includes("regex parse error") ||
          stderr.includes("error parsing regex") ||
          stderr.includes("error:"))
      ) {
        return reject(new Error(`Invalid regex pattern '${args.pattern}': ${stderr.trim()}`))
      }

      const matches: Array<{ file: string; line: number; text: string }> = []
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === "match") {
            const relFile = parsed.data.path.text.replace(/^(\.[\\/])+/u, "")
            matches.push({
              file: relFile,
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

// 6. GLOB TOOL (Ripgrep-based file matcher from OpenCode ripgrep.ts - safe & no shell injection)
async function executeGlob(args: { pattern: string; path?: string; hidden?: boolean }): Promise<any> {
  const base = path.resolve(args.path ?? ".")
  if (!existsSync(base) || !statSync(base).isDirectory()) {
    throw new Error(`Path must be an existing directory: ${base}`)
  }

  const rgArgs = [
    "--no-config",
    "--files",
    ...(args.hidden ? ["--hidden"] : []),
    `--glob=${args.pattern}`,
    "--glob=!**/.git/**",
    "--glob=!**/node_modules/**",
    ".",
  ]

  return new Promise((resolve) => {
    const proc = spawn("rg", rgArgs, { cwd: base })
    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8")
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8")
    })

    proc.on("error", (err: any) => {
      resolve({
        pattern: args.pattern,
        base,
        error: `Ripgrep execution error: ${err.message}. Ensure ripgrep is installed.`,
        matches: [],
      })
    })

    proc.on("close", (code) => {
      // code 1 means no matches found in ripgrep
      if (code === 1 || !stdout.trim()) {
        return resolve({
          pattern: args.pattern,
          base,
          matches: [],
        })
      }

      const files = stdout
        .split("\n")
        .map((f) => f.trim().replace(/^(\.[\\/])+/u, ""))
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

// 8. INSTRUCTIONS (Preserved OpenCode project/global instructions)
async function executeInstructions(args: { directory?: string }): Promise<any> {
  const instructions = await loadSystemInstructions({ directory: args.directory })
  return {
    instructions,
    count: instructions.length,
  }
}

// 9. SYSTEM PROMPT (Preserved OpenCode agent intelligence & system prompts)
function executeSystemPrompt(args: { model?: string; agent?: string }): any {
  const modelId = args.model ?? "default"
  const prompts = provider(modelId)
  const agentInfo = args.agent ? (BuiltinAgents as Record<string, any>)[args.agent] : undefined
  return {
    model: modelId,
    system_prompt: prompts.join("\n\n"),
    agent: agentInfo,
    available_agents: Object.keys(BuiltinAgents),
  }
}

// 10. APPLESCRIPT TOOL (Direct stdin execution - handles multiline scripts and quotes)
async function executeAppleScript(args: { script: string }): Promise<any> {
  if (!args.script || !args.script.trim()) {
    throw new Error("AppleScript cannot be empty")
  }
  return new Promise((resolve, reject) => {
    const proc = spawn("osascript", ["-"])
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8")
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8")
    })
    proc.on("error", (err: any) => {
      reject(err)
    })
    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`AppleScript failed (exit ${code}): ${stderr.trim() || stdout.trim()}`),
        )
      }
      resolve({ output: stdout.trim() })
    })
    proc.stdin.write(args.script)
    proc.stdin.end()
  })
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
      case "instructions":
        result = await executeInstructions(req.args as any)
        break
      case "system_prompt":
        result = executeSystemPrompt(req.args as any)
        break
      case "applescript":
        result = await executeAppleScript(req.args as any)
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
process.stderr.write("[OpenAgent Harness] Ready on stdio IPC\n")
