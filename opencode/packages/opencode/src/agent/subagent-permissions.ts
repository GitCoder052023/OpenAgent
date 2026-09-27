import type { Agent } from "./agent"

export interface PermissionRule {
  permission: string
  pattern?: string
  action: "allow" | "deny" | "ask"
}
export type Ruleset = PermissionRule[]

/**
 * Build the `permission` ruleset for a subagent's session when it's spawned
 * via the task tool. Combines:
 *
 * 1. The parent session's deny rules and external_directory rules.
 *    Parent agent restrictions only govern that agent; the subagent's own
 *    permissions determine its capabilities.
 * 2. Default `todowrite` and `task` denies if the subagent's own ruleset
 *    doesn't already permit them.
 */
export function deriveSubagentSessionPermission(input: {
  parentSessionPermission: Ruleset
  subagent: Agent.Info
}): Ruleset {
  const canTask = input.subagent.permission?.some((rule) => rule.permission === "task")
  const canTodo = input.subagent.permission?.some((rule) => rule.permission === "todowrite")
  return [
    ...input.parentSessionPermission.filter(
      (rule) => rule.permission === "external_directory" || rule.action === "deny",
    ),
    ...(canTodo ? [] : [{ permission: "todowrite", pattern: "*", action: "deny" as const }]),
    ...(canTask ? [] : [{ permission: "task", pattern: "*", action: "deny" as const }]),
  ]
}
