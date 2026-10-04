import PROMPT_GENERATE from "./generate.txt"
import PROMPT_COMPACTION from "./prompt/compaction.txt"
import PROMPT_EXPLORE from "./prompt/explore.txt"
import PROMPT_SUMMARY from "./prompt/summary.txt"
import PROMPT_TITLE from "./prompt/title.txt"

export const Prompts = {
  generate: PROMPT_GENERATE,
  compaction: PROMPT_COMPACTION,
  explore: PROMPT_EXPLORE,
  summary: PROMPT_SUMMARY,
  title: PROMPT_TITLE,
}

export interface PermissionRule {
  permission: string
  pattern?: string
  action: "allow" | "deny" | "ask"
}

export interface Info {
  name: string
  description?: string
  mode?: "subagent" | "primary" | "all"
  native?: boolean
  hidden?: boolean
  topP?: number
  temperature?: number
  color?: string
  permission?: PermissionRule[]
  prompt?: string
  options?: Record<string, unknown>
  steps?: number
}

export interface GeneratedAgent {
  identifier: string
  whenToUse: string
  systemPrompt: string
}

export const BuiltinAgents: Record<string, Info> = {
  build: {
    name: "build",
    description: "The default primary agent. Executes tools based on configured permissions.",
    mode: "primary",
    native: true,
    options: {},
  },
  plan: {
    name: "plan",
    description: "Plan mode. Disallows all edit tools and formulates step-by-step plans.",
    mode: "primary",
    native: true,
    options: {},
  },
  general: {
    name: "general",
    description: "General-purpose agent for researching complex questions and executing multi-step tasks in parallel.",
    mode: "subagent",
    native: true,
    options: {},
  },
  explore: {
    name: "explore",
    description: "Fast agent specialized for exploring codebases, searching keywords, and locating files.",
    prompt: PROMPT_EXPLORE,
    mode: "subagent",
    native: true,
    options: {},
  },
  compaction: {
    name: "compaction",
    mode: "primary",
    native: true,
    hidden: true,
    prompt: PROMPT_COMPACTION,
    options: {},
  },
  title: {
    name: "title",
    mode: "primary",
    native: true,
    hidden: true,
    temperature: 0.5,
    prompt: PROMPT_TITLE,
    options: {},
  },
  summary: {
    name: "summary",
    mode: "primary",
    native: true,
    hidden: true,
    prompt: PROMPT_SUMMARY,
    options: {},
  },
}

export * as Agent from "./agent"
