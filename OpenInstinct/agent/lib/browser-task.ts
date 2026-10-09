import { z } from "zod";

export const browserTaskReceiptSchema = z.object({
  kind: z.literal("tool-result"),
  toolName: z.literal("run_browser"),
  output: z.object({ status: z.literal("working"), taskId: z.string().min(1) }),
});
