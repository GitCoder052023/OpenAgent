import path from "node:path"
import fs from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"

export const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md"]

export interface InstructionFile {
  filepath: string
  content: string
}

export async function findInstructionUp(startDir: string, stopDir?: string): Promise<string | undefined> {
  let current = path.resolve(startDir)
  const stop = stopDir ? path.resolve(stopDir) : path.parse(current).root

  while (true) {
    for (const name of INSTRUCTION_FILES) {
      const candidate = path.join(current, name)
      if (existsSync(candidate)) return candidate
    }
    if (current === stop || current === path.dirname(current)) break
    current = path.dirname(current)
  }
  return undefined
}

export async function loadSystemInstructions(options?: {
  directory?: string
  worktree?: string
  home?: string
}): Promise<string[]> {
  const dir = options?.directory ?? process.cwd()
  const home = options?.home ?? os.homedir()
  const paths: string[] = []

  const globalClaude = path.join(home, ".claude", "CLAUDE.md")
  if (existsSync(globalClaude)) paths.push(globalClaude)

  const projectInstruction = await findInstructionUp(dir, options?.worktree)
  if (projectInstruction && !paths.includes(projectInstruction)) {
    paths.push(projectInstruction)
  }

  const results: string[] = []
  for (const p of paths) {
    try {
      const content = await fs.readFile(p, "utf-8")
      if (content.trim()) {
        results.push(`Instructions from: ${p}\n${content}`)
      }
    } catch {
      // ignore unreadable
    }
  }
  return results
}

export * as Instruction from "./instruction"
