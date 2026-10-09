import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { taskCompletionSchema } from "@agent/subagents/browser-agent/lib/completion";

export default defineWorkflowTool({
  description:
    "Execute one bounded browser assignment and return a verified result with optional private image artifacts. Pass agentId to continue a parked worker. The completion schema is supplied automatically.",
  inputSchema: z.object({
    message: z.string().min(1),
    agentId: z.string().optional(),
  }),
  execution: "background",
  async execute(input, ctx) {
    "use workflow";
    const result = await ctx.agent("browser-agent", {
      ...input,
      outputSchema: z
        .record(z.string(), z.json())
        .parse(z.toJSONSchema(taskCompletionSchema)),
    });
    return taskCompletionSchema.parse(result);
  },
});
