import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_GPT from "./prompt/gpt.txt"
import PROMPT_ASTRA from "./prompt/gpt-astra.txt"
import PROMPT_KIMI from "./prompt/kimi.txt"
import PROMPT_META from "./prompt/meta.txt"
import PROMPT_CODEX from "./prompt/codex.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"

export const Prompts = {
  anthropic: PROMPT_ANTHROPIC,
  default: PROMPT_DEFAULT,
  beast: PROMPT_BEAST,
  gemini: PROMPT_GEMINI,
  gpt: PROMPT_GPT,
  astra: PROMPT_ASTRA,
  kimi: PROMPT_KIMI,
  meta: PROMPT_META,
  codex: PROMPT_CODEX,
  trinity: PROMPT_TRINITY,
}

export function provider(modelId: string, providerId = ""): string[] {
  const id = modelId.toLowerCase()
  if (id.includes("muse")) {
    const name = id.includes("muse-glimmer") ? "Muse Glimmer" : "Muse Spark"
    return [PROMPT_META.replaceAll("{{MODEL_NAME}}", name)]
  }
  if (id.includes("gpt-4") || id.includes("o1") || id.includes("o3")) return [PROMPT_BEAST]
  if (id.includes("gpt")) {
    if (id.includes("gpt-6")) return [PROMPT_ASTRA]
    if (id.includes("codex")) return [PROMPT_CODEX]
    return [PROMPT_GPT]
  }
  if (id.includes("gemini-")) return [PROMPT_GEMINI]
  if (id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (id.includes("trinity")) return [PROMPT_TRINITY]
  if (id.includes("kimi") || ["kimi-for-coding", "moonshotai", "moonshotai-cn"].includes(providerId)) {
    return [PROMPT_KIMI]
  }
  return [PROMPT_DEFAULT]
}

export function environment(opts: {
  modelId: string
  providerId?: string
  directory: string
  worktree: string
  isGit?: boolean
  references?: Array<{ name: string; path: string; description?: string }>
}): string[] {
  const parts = [
    [
      `You are powered by the model named ${opts.modelId}. The exact model ID is ${opts.providerId ? opts.providerId + "/" : ""}${opts.modelId}`,
      `Here is some useful information about the environment you are running in:`,
      `<env>`,
      `  Working directory: ${opts.directory}`,
      `  Workspace root folder: ${opts.worktree}`,
      `  Is directory a git repo: ${opts.isGit ? "yes" : "no"}`,
      `  Platform: ${process.platform}`,
      `  Today's date: ${new Date().toDateString()}`,
      `</env>`,
    ].join("\n"),
  ]

  if (opts.references && opts.references.length > 0) {
    parts.push(
      [
        "Project references provide additional directories that can be accessed when relevant.",
        "<available_references>",
        ...opts.references
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .flatMap((ref) => [
            "  <reference>",
            `    <name>${ref.name}</name>`,
            `    <path>${ref.path}</path>`,
            ...(ref.description ? [`    <description>${ref.description}</description>`] : []),
            "  </reference>",
          ]),
        "</available_references>",
      ].join("\n"),
    )
  }

  return parts
}

export function skills(list: Array<{ name: string; description?: string }>): string {
  return [
    "Skills provide specialized instructions and workflows for specific tasks.",
    "Use the skill tool to load a skill when a task matches its description.",
    "<available_skills>",
    ...list.flatMap((skill) => [
      "  <skill>",
      `    <name>${skill.name}</name>`,
      ...(skill.description ? [`    <description>${skill.description}</description>`] : []),
      "  </skill>",
    ]),
    "</available_skills>",
  ].join("\n")
}

export function mcp(servers: Array<{ name: string; instructions: string }>): string | undefined {
  if (servers.length === 0) return undefined
  return [
    "<mcp_instructions>",
    ...servers.flatMap((item) => [
      `  <server name="${item.name}">`,
      ...item.instructions.split("\n").map((line) => `    ${line}`),
      "  </server>",
    ]),
    "</mcp_instructions>",
  ].join("\n")
}

export * as SystemPrompt from "./system"
