import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { defineEval, type EveEvalContext, type EveEvalTurn } from "eve/evals";
import { equals } from "eve/evals/expect";
import type { MessageStreamEvent } from "eve/client";
import { browserTaskReceiptSchema } from "@agent/lib/browser-task";
import { taskCompletionOutputSchema } from "@agent/subagents/browser-agent/lib/completion";

async function waitForToolMarker(
  sessionId: string,
  marker: "started" | "aborted",
  signal: AbortSignal
) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  // The tool executes in Eve's worker process; its marker proves entry or abort observation.
  while (!existsSync(join(".eve", "fixture-tool", sessionId, marker))) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- bounded observation of a marker written by the runtime worker.
    await setTimeout(10, undefined, { signal: deadline });
  }
}

async function followUntil(
  t: EveEvalContext,
  initial: EveEvalTurn,
  predicate: (event: MessageStreamEvent) => boolean
) {
  let turn = initial;
  const events = [...turn.events];
  // Each iteration continues at the cursor of the preceding settled turn.
  /* oxlint-disable eslint/no-await-in-loop */
  for (let attempt = 0; attempt < 8 && !events.some(predicate); attempt += 1) {
    turn = await t.target
      .watchTurn(turn.sessionId, { startIndex: turn.session.state.streamIndex })
      .result();
    turn.expectOk();
    events.push(...turn.events);
  }
  /* oxlint-enable eslint/no-await-in-loop */
  if (!events.some(predicate))
    throw new Error("Expected lifecycle event was not observed.");
  return { turn, events };
}

function calledAgent(events: readonly MessageStreamEvent[]) {
  const called = events.find((event) => event.type === "subagent.called");
  if (!called?.data.agentId)
    throw new Error("No child invocation was recorded.");
  return called.data;
}

function checkCompletion(
  t: EveEvalContext,
  events: readonly MessageStreamEvent[]
) {
  const completed = events.find((event) => event.type === "subagent.completed");
  if (!completed) throw new Error("No child completion was recorded.");
  t.check(
    taskCompletionOutputSchema.parse(completed.data.output),
    equals({
      images: [],
      status: "success",
      message: "Verified fixture outcome",
    })
  );
}

export default [
  defineEval({
    description:
      "Completes background browser work and resumes the same structured worker",
    async test(t) {
      const first = await t.send("Start");
      first.expectOk();
      first.requireToolCall("run_browser", {
        status: "completed",
      });
      const admission = first.events.find(
        (candidate) =>
          candidate.type === "action.result" &&
          candidate.data.result.kind === "tool-result" &&
          candidate.data.result.toolName === "run_browser"
      );
      if (admission?.type !== "action.result")
        throw new Error("Browser admission event is missing.");
      const parsed = browserTaskReceiptSchema.parse(admission.data.result);
      t.check(parsed.output.status, equals("working"));
      const initial = await followUntil(
        t,
        first,
        (event) => event.type === "subagent.completed"
      );
      const called = calledAgent(initial.events);
      checkCompletion(t, initial.events);
      const resumed = await initial.turn.session.send(
        `Resume:${String(called.agentId)}`
      );
      resumed.expectOk();
      const continued = await followUntil(
        t,
        resumed,
        (event) => event.type === "subagent.completed"
      );
      const next = calledAgent(continued.events);
      t.check(next.agentId, equals(called.agentId));
      t.check(next.childSessionId, equals(called.childSessionId));
      checkCompletion(t, continued.events);
    },
  }),
  defineEval({
    description: "Cancels admitted browser work while a child tool is running",
    async test(t) {
      const first = await t.send("Wait");
      first.expectOk();
      first.requireToolCall("run_browser", {
        status: "completed",
      });
      const admission = first.events.find(
        (candidate) =>
          candidate.type === "action.result" &&
          candidate.data.result.kind === "tool-result" &&
          candidate.data.result.toolName === "run_browser"
      );
      if (admission?.type !== "action.result")
        throw new Error("Browser admission event is missing.");
      const parsed = browserTaskReceiptSchema.parse(admission.data.result);
      const activity = t.target.watchTurn(first.sessionId, {
        startIndex: first.session.state.streamIndex,
      });
      const called =
        first.events.find((event) => event.type === "subagent.called") ??
        (await activity.waitForEvent("subagent.called"));
      let toolStarted = false;
      for await (const event of first.session.streamSubagent(called, {
        signal: t.signal,
      })) {
        if (
          event.type === "actions.requested" &&
          event.data.actions.some(
            (action) =>
              action.kind === "tool-call" &&
              action.toolName === "wait_for_cancellation"
          )
        ) {
          toolStarted = true;
          break;
        }
      }
      t.check(toolStarted, equals(true));
      await waitForToolMarker(called.data.childSessionId, "started", t.signal);
      const cancelled = await first.session.send(
        `Cancel:${parsed.output.taskId}`
      );
      cancelled.expectOk();

      await activity.result();
      cancelled.calledTool("task_cancel", { status: "completed", count: 1 });
      let childCancelled = false;
      for await (const event of first.session.streamSubagent(called, {
        signal: t.signal,
      })) {
        if (event.type === "turn.cancelled") {
          childCancelled = true;
        }
        if (event.type === "session.waiting" && childCancelled) break;
        if (event.type === "result.completed")
          throw new Error("Cancelled worker produced a successful result.");
      }
      t.check(childCancelled, equals(true));
      await waitForToolMarker(called.data.childSessionId, "aborted", t.signal);
      const resumed = await cancelled.session.send(
        `Resume:${String(called.data.agentId)}`
      );
      resumed.expectOk();
      const continued = await followUntil(
        t,
        resumed,
        (event) => event.type === "subagent.completed"
      );
      const next = calledAgent(continued.events);
      t.check(next.agentId, equals(called.data.agentId));
      t.check(next.childSessionId, equals(called.data.childSessionId));
      checkCompletion(t, continued.events);
    },
  }),
];
