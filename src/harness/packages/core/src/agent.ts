export * as AgentV2 from "./agent"

export type ID = string
export const defaultID: ID = "build"

export interface Info {
  readonly id: ID
  readonly name: string
  readonly description?: string
  readonly mode?: "subagent" | "primary" | "all"
  readonly native?: boolean
  readonly hidden?: boolean
  readonly topP?: number
  readonly temperature?: number
  readonly color?: string
  readonly variant?: string
  readonly prompt?: string
  readonly options?: Record<string, unknown>
  readonly steps?: number
}

export interface Selection {
  readonly id: ID
  readonly info: Info | undefined
}

export type Draft = {
  list: () => readonly Info[]
  get: (id: ID) => Info | undefined
  default: (id: ID | undefined) => void
  update: (id: ID, fn: (agent: Info) => void) => void
  remove: (id: ID) => void
}
