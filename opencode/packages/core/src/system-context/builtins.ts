export * as SystemContextBuiltIns from "./builtins"

import { DateTime, Effect, Layer, Schema } from "effect"
import { SystemContext } from "./index"
import { SystemContextRegistry } from "./registry"

export function renderEnvironment(opts: {
  directory: string
  worktree: string
  isGit?: boolean
  platform?: string
}) {
  return [
    "Here is some useful information about the environment you are running in:",
    "<env>",
    `  Working directory: ${opts.directory}`,
    `  Workspace root folder: ${opts.worktree}`,
    `  Is directory a git repo: ${opts.isGit ? "yes" : "no"}`,
    `  Platform: ${opts.platform ?? process.platform}`,
    `  Today's date: ${new Date().toDateString()}`,
    "</env>",
  ].join("\n")
}

export const layer = (env: { directory: string; worktree: string; isGit?: boolean }) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const registry = yield* SystemContextRegistry.Service
      const environmentText = renderEnvironment({
        directory: env.directory,
        worktree: env.worktree,
        isGit: env.isGit,
      })
      const context = SystemContext.combine([
        SystemContext.make({
          key: SystemContext.Key.make("core/environment"),
          codec: Schema.toCodecJson(Schema.String),
          load: Effect.succeed(environmentText),
          baseline: (env) => env,
          update: (_previous, env) => ["The environment you are running in is now:", env].join("\n"),
        }),
        SystemContext.make({
          key: SystemContext.Key.make("core/date"),
          codec: Schema.toCodecJson(Schema.String),
          load: DateTime.nowAsDate.pipe(Effect.map((date) => date.toDateString())),
          baseline: (date) => `Today's date: ${date}`,
          update: (_previous, date) => `Today's date is now: ${date}`,
        }),
      ])

      yield* registry.register({ key: SystemContext.Key.make("core/builtins"), load: Effect.succeed(context) })
    }),
  )
