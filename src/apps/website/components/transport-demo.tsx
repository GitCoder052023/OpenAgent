"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scenarios, type DemoScenario, type DemoStep } from "@/lib/demo";
import { SectionLabel } from "@/components/primitives";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * One request, end to end.
 *
 * This replays the loop documented in README.md § How It Works against the
 * real envelope format from docs/JARVIS_INSTRUCTIONS.md: a spoken turn leaves
 * as a voice note, comes back as JARVIS_CALL:<base64>:END, is verified against
 * the chat header, executes locally, and reports back. The base64 strings are
 * genuine encodings of the JSON printed beneath them. Results are illustrative.
 */

type Event =
  | { k: "you"; turn: number; text: string; aside: string }
  | { k: "call"; turn: number; idx: number; step: DemoStep }
  | { k: "result"; turn: number; idx: number; step: DemoStep }
  | { k: "reply"; turn: number; text: string };

const DURATION: Record<Event["k"], number> = {
  you: 1600,
  call: 1050,
  result: 800,
  reply: 2200,
};

function buildEvents(scenario: DemoScenario): Event[] {
  const events: Event[] = [];
  scenario.turns.forEach((turn, t) => {
    events.push({ k: "you", turn: t, text: turn.spoken, aside: turn.aside });
    turn.steps.forEach((step, i) => {
      events.push({ k: "call", turn: t, idx: i, step });
      events.push({ k: "result", turn: t, idx: i, step });
    });
    events.push({ k: "reply", turn: t, text: turn.reply });
  });
  return events;
}

export function TransportDemo() {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const started = useRef(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const scenario = scenarios[active];
  const events = useMemo(() => buildEvents(scenario), [scenario]);

  // Index just past the first turn's reply. Until the replay actually starts —
  // and whenever motion is suppressed — the panel shows a finished turn rather
  // than an empty frame, so the server-rendered markup is already meaningful.
  const firstTurnEnd = useMemo(
    () => events.findIndex((e) => e.k === "reply") + 1,
    [events],
  );
  const cursor = reduced
    ? firstTurnEnd
    : playing || tick > 0
      ? tick
      : firstTurnEnd;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setPlaying(true);
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !playing || cursor >= events.length) return;
    const t = window.setTimeout(
      () => setTick((c) => c + 1),
      DURATION[events[cursor].k],
    );
    return () => window.clearTimeout(t);
  }, [playing, cursor, events, reduced]);

  const finished = cursor >= events.length;
  // Items only animate in while the replay is actually playing.
  const arrive = reduced ? "" : "animate-[arrive_260ms_ease-out]";

  function select(i: number) {
    setActive(i);
    setTick(0);
    setPlaying(true);
  }

  function replay() {
    setTick(0);
    setPlaying(true);
  }

  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (active + 1) % scenarios.length
        : (active - 1 + scenarios.length) % scenarios.length;
    select(next);
    const buttons = tabsRef.current?.querySelectorAll("button");
    buttons?.[next]?.focus();
  }

  // Only the turn in flight is on screen, the way a live session reads.
  const shown = events.slice(0, cursor);
  const currentTurn = shown.length ? shown[shown.length - 1].turn : 0;
  const turnEvents = shown.filter((e) => e.turn === currentTurn);

  const receipts: { step: DemoStep; done: boolean }[] = [];
  for (const e of turnEvents) {
    if (e.k === "call") receipts.push({ step: e.step, done: false });
    if (e.k === "result" && receipts[e.idx]) receipts[e.idx].done = true;
  }

  return (
    <section
      id="transport"
      ref={sectionRef}
      className="scroll-mt-24 bg-taupe py-16 sm:py-20 lg:py-32"
    >
      <div className="gutter">
        <div className="grid items-end gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel>One request, end to end</SectionLabel>
            <h2 className="mt-6 text-heading text-ink lg:text-display">
              You speak. Your Mac does the work.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-body text-smoke">
              There is no API key and no hosted backend between the two halves.
              WhatsApp Desktop is the transport, the Accessibility API is the
              reader, and a fail-closed guard decides whether anything runs at
              all.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:mt-12">
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Example sessions"
            onKeyDown={onTabKey}
            className="flex flex-wrap gap-2"
          >
            {scenarios.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`tab-${s.id}`}
                aria-selected={i === active}
                aria-controls="transport-panel"
                tabIndex={i === active ? 0 : -1}
                onClick={() => select(i)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-sm transition-colors duration-200 ${
                  i === active
                    ? "border-stone bg-eggshell text-ink"
                    : "border-transparent text-smoke hover:border-stone hover:text-graphite"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${
                    i === active ? "bg-spark" : "bg-stone"
                  }`}
                />
                {s.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={replay}
            className="-mx-2 inline-flex min-h-11 items-center gap-2 px-2 font-mono text-code text-graphite transition-colors duration-200 hover:text-ink"
          >
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M10.5 6a4.5 4.5 0 1 1-1.6-3.44M10.5 1.2V3.6H8.1"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="square"
              />
            </svg>
            {finished || reduced ? "Replay" : "Restart"}
          </button>
        </div>

        <div
          id="transport-panel"
          role="tabpanel"
          aria-labelledby={`tab-${scenario.id}`}
          className="mt-5 overflow-hidden rounded-card bg-eggshell shadow-whisper"
        >
          {/* Lane headers. The vertical rule between them is the boundary
              between a cloud assistant and bare metal. */}
          <div className="grid grid-cols-1 border-b border-stone lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 sm:px-5 lg:border-r lg:border-stone">
              <span className="font-mono text-caption uppercase text-graphite">
                WhatsApp Desktop · transport
              </span>
              <span className="font-mono text-caption uppercase text-smoke">
                cloud ↔ local
              </span>
            </div>
            <div className="hidden items-center justify-between gap-3 px-5 py-3 lg:flex">
              <span className="font-mono text-caption uppercase text-graphite">
                This Mac · execution
              </span>
              <span className="font-mono text-caption uppercase text-smoke">
                bare metal
              </span>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="grid grid-cols-1 lg:min-h-[24rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
          >
            {/* The chat lane */}
            <div className="min-w-0 space-y-4 border-b border-stone px-4 py-5 sm:px-5 sm:py-6 lg:border-b-0 lg:border-r">
              {turnEvents.map((e, i) => {
                if (e.k === "you") {
                  return (
                    <div key={i} className={arrive}>
                      <p className="font-mono text-caption uppercase text-smoke">
                        you · {e.aside} · voice note
                      </p>
                      <p className="mt-2 text-body-sm text-ink">{e.text}</p>
                    </div>
                  );
                }
                if (e.k === "call") {
                  return (
                    <div
                      key={i}
                      className={`min-w-0 border-l border-stone pl-3 ${arrive}`}
                    >
                      <p className="font-mono text-caption uppercase text-smoke">
                        instinct → envelope
                      </p>
                      <p className="mt-1.5 flex min-w-0 font-mono text-micro text-smoke">
                        <span className="shrink-0 text-graphite">
                          JARVIS_CALL:
                        </span>
                        <span className="truncate">{e.step.envelope}</span>
                        <span className="shrink-0 text-graphite">:END</span>
                      </p>
                      <p className="mt-2 flex min-w-0 gap-2 font-mono text-micro text-graphite">
                        <span className="text-spark">↳</span>
                        <span className="truncate" title={e.step.json}>
                          {e.step.json}
                        </span>
                      </p>
                    </div>
                  );
                }
                if (e.k === "result") {
                  return (
                    <p
                      key={i}
                      className={`truncate font-mono text-micro text-smoke ${arrive}`}
                    >
                      [Jarvis Tool Response: {e.step.tool} | status: ok]
                    </p>
                  );
                }
                return (
                  <div key={i} className={arrive}>
                    <p className="font-mono text-caption uppercase text-smoke">
                      jarvis · spoken reply
                    </p>
                    <p className="mt-2 text-body-sm text-ink">{e.text}</p>
                  </div>
                );
              })}
            </div>

            {/* The receipt lane */}
            <div className="min-w-0 px-4 py-5 sm:px-5 sm:py-6">
              <p className="mb-3 font-mono text-caption uppercase text-graphite lg:hidden">
                This Mac · execution
              </p>
              {receipts.length === 0 ? null : (
                /* Step 04: nothing below this line runs until the message is
                   proven to have come from the verified chat. */
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-stone pb-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 size-1.5 shrink-0 rounded-full bg-spark"
                  />
                  <span className="font-mono text-code text-graphite">
                    verified chat header
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-micro text-smoke sm:text-code">
                    BRIDGE_SAFE_MODE=true
                  </span>
                </div>
              )}
              <ul className="space-y-0">
                {receipts.map((r, i) => (
                  <li
                    key={i}
                    className={`border-b border-stone py-3 last:border-0 ${arrive}`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        className={`mt-1 size-1.5 shrink-0 rounded-full ${
                          r.done ? "bg-ink" : "bg-spark"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-code text-ink sm:w-[8.5rem] sm:flex-none xl:w-[9.5rem]">
                        {r.step.tool}
                      </span>
                      <span className="hidden min-w-0 flex-1 truncate font-mono text-code text-smoke sm:block">
                        {r.step.argLabel}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-code text-graphite">
                        {r.done ? r.step.result : "running…"}
                      </span>
                    </div>
                    <p className="mt-1 truncate pl-[1.125rem] font-mono text-micro text-smoke sm:hidden">
                      {r.step.argLabel}
                    </p>
                  </li>
                ))}
              </ul>
              {turnEvents.some((e) => e.k === "reply") ? (
                <p className="mt-4 font-mono text-micro text-smoke">
                  {receipts.length} {receipts.length === 1 ? "call" : "calls"}{" "}
                  dispatched locally · result returned to the same thread
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-stone px-4 py-3 sm:px-5">
            <span className="font-mono text-caption uppercase text-smoke">
              {scenario.engines}
            </span>
            <span className="font-mono text-caption uppercase text-smoke">
              turn {Math.min(currentTurn + 1, scenario.turns.length)} /{" "}
              {scenario.turns.length} · illustrative replay, real protocol
            </span>
          </div>
        </div>

        {/* The same session, linearised, for assistive technology. */}
        <div className="sr-only">
          <h3>Example session: {scenario.label}</h3>
          {scenario.turns.map((turn, t) => (
            <div key={t}>
              <p>You said: {turn.spoken}</p>
              <ol>
                {turn.steps.map((step, i) => (
                  <li key={i}>
                    Tool {step.tool} called with {step.json}. Result:{" "}
                    {step.result}.
                  </li>
                ))}
              </ol>
              <p>Jarvis replied: {turn.reply}</p>
            </div>
          ))}
          <p>
            Tool names and the envelope format are real. Results shown are
            illustrative.
          </p>
        </div>
      </div>
    </section>
  );
}
