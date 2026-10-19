"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * The listening contract, drawn.
 *
 * OpenAgent's microphone is always on, but the line to the outside world is
 * not: wake-word detection runs offline on Whisper Large V3 Turbo and idle
 * audio is never saved or sent. This trace animates that one fact — flat and
 * local while asleep, live only once you have woken it — so the privacy model
 * is visible instead of merely claimed. It holds still under
 * prefers-reduced-motion and whenever it is off screen.
 */

const BAR_COUNT = 64;

// Deterministic amplitudes so the server and client render identically.
const AMPLITUDES = Array.from({ length: BAR_COUNT }, (_, i) => {
  const n = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1;
  const envelope = Math.sin((i / (BAR_COUNT - 1)) * Math.PI) ** 0.5;
  return 0.18 + n * 0.82 * envelope;
});

type Phase = "sleeping" | "waking" | "awake" | "sending" | "standby";

const SCRIPT: { phase: Phase; hold: number; caption: string }[] = [
  { phase: "sleeping", hold: 3600, caption: "microphone on · nothing transmitted" },
  { phase: "waking", hold: 1500, caption: "“Wake up, Jarvis”" },
  { phase: "awake", hold: 4200, caption: "speak freely · pause to send" },
  { phase: "sending", hold: 2000, caption: "voice note → Instinct chat" },
  { phase: "standby", hold: 1800, caption: "“Jarvis, stand by”" },
];

export function WakeMeter() {
  const [index, setIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // With motion suppressed the trace rests in its awake state, which is the
  // frame that carries the point.
  const step = reduced ? 2 : index;
  const running = onScreen && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(
      () => setIndex((i) => (i + 1) % SCRIPT.length),
      SCRIPT[index].hold,
    );
    return () => window.clearTimeout(t);
  }, [index, running]);

  const { phase, caption } = SCRIPT[step];
  const live = phase === "awake" || phase === "sending";
  const label =
    phase === "sleeping" || phase === "standby"
      ? "[ Jarvis sleeping ]"
      : "[ Jarvis awake ]";

  return (
    <div
      ref={ref}
      className="rounded-card bg-eggshell p-6 shadow-whisper sm:p-7"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-code text-ink">{label}</span>
        <span className="flex items-center gap-2 font-mono text-caption uppercase text-smoke">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full transition-colors duration-500 ${
              live ? "bg-spark" : "bg-stone"
            }`}
          />
          {live ? "transmitting" : "local only"}
        </span>
      </div>

      <div
        className="relative mt-6 flex h-20 items-center justify-between gap-px"
        role="img"
        aria-label="Signal trace: the microphone runs locally at all times and only transmits once the wake phrase has been spoken."
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px bg-stone"
        />
        {AMPLITUDES.map((a, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`relative w-px origin-center bg-ink transition-[transform,opacity] duration-700 ease-out ${
              live ? "opacity-80" : "opacity-35"
            }`}
            style={{
              height: `${Math.round(a * 72)}px`,
              transform: live ? undefined : "scaleY(0.035)",
              animation: live
                ? `wake-trace ${900 + (i % 7) * 110}ms ease-in-out ${i * 9}ms infinite alternate`
                : undefined,
            }}
          />
        ))}
      </div>

      <div className="mt-5 h-px bg-stone" aria-hidden="true" />

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-mono text-code text-graphite">{caption}</p>
        <p className="font-mono text-caption uppercase text-smoke">
          whisper large v3 turbo · on device
        </p>
      </div>
    </div>
  );
}
