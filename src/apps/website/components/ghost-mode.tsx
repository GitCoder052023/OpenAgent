import { ghostPoints } from "@/lib/content";
import { SectionLabel } from "@/components/primitives";

const TICKS = [
  { x: 262, label: "browser_open" },
  { x: 432, label: "browser_ax" },
  { x: 602, label: "social_post" },
  { x: 772, label: "screencapture -l" },
  { x: 942, label: "mac_ax" },
];

function FocusLanes() {
  return (
    <svg
      viewBox="0 0 1120 176"
      className="w-full"
      role="img"
      aria-label="Two parallel tracks. The upper track is your own focus — a fullscreen application with the pointer captured — and it runs unbroken from left to right. The lower track is the agent, executing browser_open, browser_ax, social_post, screencapture and mac_ax offscreen. A marker shows the active application PID being captured before the agent starts, and focus being restored afterwards."
    >
      <text
        x="0"
        y="50"
        fontSize="11"
        fontFamily="var(--font-geist-mono), monospace"
        fill="#44403b"
      >
        YOUR FOCUS
      </text>
      <text
        x="0"
        y="130"
        fontSize="11"
        fontFamily="var(--font-geist-mono), monospace"
        fill="#44403b"
      >
        AGENT
      </text>

      <text
        x="150"
        y="28"
        fontSize="11"
        fontFamily="var(--font-geist-mono), monospace"
        fill="#777169"
      >
        fullscreen app · pointer captured · never interrupted
      </text>

      <line x1="150" y1="46" x2="1112" y2="46" stroke="#000000" strokeWidth="1.5" />
      <line x1="150" y1="38" x2="150" y2="54" stroke="#000000" strokeWidth="1.5" />
      <line x1="1112" y1="38" x2="1112" y2="54" stroke="#000000" strokeWidth="1.5" />

      <line
        x1="150"
        y1="126"
        x2="1112"
        y2="126"
        stroke="#0447ff"
        strokeWidth="1"
        strokeDasharray="1 5"
        strokeLinecap="round"
      />

      {TICKS.map((t) => (
        <g key={t.label}>
          <line
            x1={t.x}
            y1="118"
            x2={t.x}
            y2="134"
            stroke="#0447ff"
            strokeWidth="1"
          />
          <text
            x={t.x}
            y="152"
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-geist-mono), monospace"
            fill="#777169"
          >
            {t.label}
          </text>
        </g>
      ))}

      {/* PID captured before any background work begins */}
      <line
        x1="196"
        y1="52"
        x2="196"
        y2="114"
        stroke="#777169"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <path d="M196 120 L192.8 113 L199.2 113 Z" fill="#777169" />
      <text
        x="204"
        y="92"
        fontSize="10"
        fontFamily="var(--font-geist-mono), monospace"
        fill="#777169"
      >
        active PID captured
      </text>

      {/* and handed back */}
      <line
        x1="1060"
        y1="114"
        x2="1060"
        y2="54"
        stroke="#777169"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <path d="M1060 48 L1056.8 55 L1063.2 55 Z" fill="#777169" />
      <text
        x="1052"
        y="92"
        textAnchor="end"
        fontSize="10"
        fontFamily="var(--font-geist-mono), monospace"
        fill="#777169"
      >
        focus restored in ms
      </text>
    </svg>
  );
}

export function GhostMode() {
  return (
    <section id="ghost" className="scroll-mt-24 bg-taupe py-24 lg:py-32">
      <div className="gutter">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionLabel>Zero-focus operation</SectionLabel>
            <h2 className="mt-6 text-heading text-ink lg:text-display">
              It works while you are using the machine.
            </h2>
          </div>
          <div className="lg:col-span-6 lg:pt-16">
            <p className="text-body text-smoke">
              Most desktop automation takes the machine away from you: windows
              raise, the cursor jumps, the game loses focus. OpenAgent captures
              the active application&rsquo;s PID first, drives Chrome over CDP
              and native apps over the Accessibility API offscreen, and hands
              focus straight back. You can be in a fullscreen Metal game with
              exclusive mouse capture while a Threads post goes out.
            </p>
          </div>
        </div>

        <div className="mt-16 hidden md:block">
          <FocusLanes />
        </div>

        <dl className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
          {ghostPoints.map((p) => (
            <div key={p.label} className="border-t border-stone pt-4">
              <dt className="text-body-sm font-medium text-ink">{p.label}</dt>
              <dd className="mt-2 text-body-sm text-smoke">{p.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
