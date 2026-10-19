"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * The transport loop, drawn to scale with the README's sequence.
 *
 * Every line here is a message that actually travels: speech into the local
 * agent, a voice note out through WhatsApp Desktop, a base64 envelope back,
 * a fail-closed verification against the chat header, local dispatch into the
 * engines, and the result returned to the same thread. Lines draw once, in the
 * direction the data moves — that is the whole job of the motion.
 */

const INK = "#000000";
const STONE = "#ebe8e4";
const SMOKE = "#777169";
// Diagram text stays at smoke or darker; ash is reserved for rules and dots.
const ASH = "#777169";
const SPARK = "#0447ff";

function Arrow({
  d,
  head,
  delay,
  color = INK,
}: {
  d: string;
  head: string;
  delay: number;
  color?: string;
}) {
  return (
    <g style={{ "--delay": `${delay}ms` } as CSSProperties}>
      <path
        className="flow-line"
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="1"
      />
      <path className="flow-head" d={head} fill={color} />
    </g>
  );
}

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  emphasis = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="10"
        fill={emphasis ? "#f5f3f1" : "#fdfcfc"}
        stroke={STONE}
        strokeWidth="1"
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 4 : y + h / 2 + 5}
        textAnchor="middle"
        fontSize="14"
        fontWeight="400"
        fill={INK}
      >
        {title}
      </text>
      {sub ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 16}
          textAnchor="middle"
          fontSize="11"
          fontFamily="var(--font-geist-mono), monospace"
          fill={SMOKE}
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Label({
  x,
  y,
  children,
  anchor = "middle",
  color = SMOKE,
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
  color?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize="11"
      fontFamily="var(--font-geist-mono), monospace"
      fill={color}
    >
      {children}
    </text>
  );
}

export function FlowDiagram() {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 1120 330"
      className={`w-full ${drawn ? "drawn" : ""}`}
      role="img"
      aria-label="Diagram of the request loop: speech enters OpenAgent on your Mac, leaves as a voice note through WhatsApp Desktop to Instinct in the cloud, returns as a base64 JARVIS_CALL envelope, passes a fail-closed verification, is dispatched to one of nine local engines, and the result travels back to the same chat thread."
    >
      {/* The boundary between a cloud assistant and your hardware. */}
      <line
        x1="772"
        y1="26"
        x2="772"
        y2="306"
        stroke={STONE}
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      <Label x={756} y={22} anchor="end" color={ASH}>
        THIS MAC
      </Label>
      <Label x={788} y={22} anchor="start" color={ASH}>
        INSTINCT · CLOUD
      </Label>

      <Node x={28} y={116} w={104} h={72} title="You" sub="speech" />
      <Node
        x={196}
        y={104}
        w={204}
        h={96}
        title="OpenAgent"
        sub="verify · dispatch"
        emphasis
      />
      <Node
        x={464}
        y={116}
        w={196}
        h={72}
        title="WhatsApp Desktop"
        sub="transport"
      />
      <Node x={856} y={116} w={180} h={72} title="Instinct" sub="reasoning" />

      {/* Outbound rail */}
      <Arrow
        d="M132 134 H188"
        head="M188 134 L181 130.8 L181 137.2 Z"
        delay={0}
      />
      <Arrow
        d="M400 134 H456"
        head="M456 134 L449 130.8 L449 137.2 Z"
        delay={160}
      />
      <Arrow
        d="M660 134 H848"
        head="M848 134 L841 130.8 L841 137.2 Z"
        delay={320}
      />
      <Label x={160} y={122}>
        01
      </Label>
      <Label x={428} y={122}>
        02
      </Label>
      <Label x={754} y={122} anchor="end">
        voice note
      </Label>

      {/* Inbound rail */}
      <Arrow
        d="M848 170 H668"
        head="M660 170 L667 166.8 L667 173.2 Z"
        delay={520}
      />
      <Arrow
        d="M456 170 H408"
        head="M400 170 L407 166.8 L407 173.2 Z"
        delay={760}
      />
      <Label x={790} y={186} anchor="start">
        03 JARVIS_CALL:…:END
      </Label>

      {/* The fail-closed guard sits on the inbound rail, before anything runs. */}
      <g>
        <rect
          x="420"
          y="156"
          width="28"
          height="28"
          rx="6"
          fill="#fdfcfc"
          stroke={SPARK}
          strokeWidth="1"
        />
        <circle cx="434" cy="170" r="3" fill={SPARK} />
      </g>
      <Label x={434} y={204}>
        04 verified chat
      </Label>
      <Label x={434} y={218} color={ASH}>
        fail-closed
      </Label>

      {/* Local dispatch */}
      <Arrow
        d="M298 200 V252"
        head="M298 260 L294.8 253 L301.2 253 Z"
        delay={940}
      />
      <Label x={312} y={230} anchor="start">
        05
      </Label>

      <rect
        x="152"
        y="262"
        width="292"
        height="44"
        rx="10"
        fill="#f5f3f1"
        stroke={STONE}
        strokeWidth="1"
      />
      <text
        x="298"
        y="289"
        textAnchor="middle"
        fontSize="12"
        fontFamily="var(--font-geist-mono), monospace"
        fill={INK}
      >
        86 tools · 9 engines · local
      </text>

      {/* Result returns to the same thread */}
      <Arrow
        d="M444 284 H562 V196"
        head="M562 188 L558.8 195 L565.2 195 Z"
        delay={1120}
        color={SMOKE}
      />
      <Label x={574} y={284} anchor="start">
        06 result
      </Label>
    </svg>
  );
}
