import { defineHook } from "eve/hooks";
import { registerBackgroundReplyTarget } from "@agent/lib/reply-targets";
import { browserTaskReceiptSchema } from "@agent/lib/browser-task";

export default defineHook({
  events: {
    "action.result"(event, context) {
      if (event.data.status !== "completed") return;
      const task = browserTaskReceiptSchema.safeParse(event.data.result);
      if (!task.success) return;
      registerBackgroundReplyTarget(
        task.data.output.taskId,
        context.session.auth
      );
    },
  },
});
