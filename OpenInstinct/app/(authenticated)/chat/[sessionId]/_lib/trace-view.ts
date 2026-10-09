import type { MessageStreamEvent } from "eve/client";
import type { EveMessage } from "eve/react";
import { z } from "zod";

const backgroundWorkerDelivery =
  /^Background task (\S+) \(browser-agent\) (?:update: |needs input\.$|is cancelled\.$|is completed\.\n\nResult:\n|failed\.\n\nError:\n)/u;
const backgroundWorkerAuthorization =
  /^Background task (\S+) needs authorization\.$/u;
const taskCancelResultSchema = z.object({
  kind: z.literal("tool-result"),
  output: z.object({ tasks: z.array(z.unknown()) }),
  toolName: z.literal("task_cancel"),
});
const cancelledWorkerTaskSchema = z.object({
  metadata: z.object({ name: z.literal("browser-agent") }),
  status: z.literal("cancelled"),
  taskId: z.string(),
});

export type TraceView = "imessage" | "trace";

export function messagesForTraceView(
  messages: readonly EveMessage[],
  events: readonly MessageStreamEvent[],
  traceView: TraceView
) {
  if (traceView === "trace") return messages;
  const hiddenMessageIds = backgroundWorkerDeliveryMessageIds(events);
  return messages.filter((message) => !hiddenMessageIds.has(message.id));
}

export function backgroundWorkerDeliveryMessageIds(
  events: readonly MessageStreamEvent[]
) {
  // Retain grammar-based filtering for saved streams from Eve < 0.61.
  // Current streams carry explicit background-task provenance.
  const taskIds = workerTaskIds(events);
  const cancelledTaskIds = new Set<string>();
  const messageIds = new Set<string>();

  for (const event of events) {
    if (event.type === "action.result") {
      const result = taskCancelResultSchema.safeParse(event.data.result);
      if (!result.success) continue;
      for (const value of result.data.output.tasks) {
        const task = cancelledWorkerTaskSchema.safeParse(value);
        if (task.success) cancelledTaskIds.add(task.data.taskId);
      }
      continue;
    }

    if (event.type !== "message.received") continue;
    if (event.data.kind === "execution.background_task") {
      messageIds.add(`${event.data.turnId}:user`);
      continue;
    }
    const taskId = deliveredTaskId(event.data.message);
    if (taskId && taskIds.has(taskId)) {
      const isCancellation = event.data.message.endsWith(
        "(browser-agent) is cancelled."
      );
      if (!isCancellation) messageIds.add(`${event.data.turnId}:user`);
      if (isCancellation && cancelledTaskIds.delete(taskId)) {
        messageIds.add(`${event.data.turnId}:user`);
        messageIds.add(`${event.data.turnId}:assistant`);
      }
    }
  }

  return messageIds;
}

function workerTaskIds(events: readonly MessageStreamEvent[]) {
  const taskIds = new Set<string>();

  for (const event of events) {
    if (
      event.type === "subagent.completed" &&
      event.data.subagentName === "browser-agent" &&
      event.data.backgroundTask !== undefined
    ) {
      taskIds.add(event.data.backgroundTask.taskId);
      continue;
    }

    if (
      event.type === "action.result" &&
      event.data.result.kind === "subagent-result" &&
      event.data.result.subagentName === "browser-agent" &&
      event.data.result.origin === "child" &&
      event.data.result.backgroundTask !== undefined
    ) {
      taskIds.add(event.data.result.backgroundTask.taskId);
    }
  }

  return taskIds;
}

function deliveredTaskId(message: string) {
  return (
    backgroundWorkerDelivery.exec(message)?.[1] ??
    backgroundWorkerAuthorization.exec(message)?.[1]
  );
}
