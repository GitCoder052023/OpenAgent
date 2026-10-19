import { voiceDefaults, voicePoints } from "@/lib/content";
import { SectionLabel } from "@/components/primitives";

const machine = [
  { state: "[ sleeping ]" },
  { edge: "“Wake up, Jarvis”" },
  { state: "[ awake ]" },
  { edge: "2.0 s of silence" },
  { state: "turn sent" },
  { edge: "“Jarvis, stand by” → confirm" },
  { state: "[ sleeping ]" },
];

export function Voice() {
  return (
    <section id="voice" className="scroll-mt-24 py-24 lg:py-32">
      <div className="gutter">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel>Talking to Jarvis</SectionLabel>
            <h2 className="mt-6 text-heading text-ink lg:text-display">
              Wake it once. Then stop thinking about the computer.
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-16">
            <p className="text-body text-smoke">
              This is built for the way Tony Stark talks to Jarvis while he is
              doing something else — not for a push-to-talk button you have to
              walk back to. Wake-word detection and transcription share one
              on-device model, so there is no second network dependency.
            </p>
          </div>
        </div>

        <ol className="mt-14 flex flex-col items-start gap-3 border-y border-stone py-7 font-mono text-code sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          {machine.map((node, i) =>
            node.state ? (
              <li
                key={i}
                className="rounded-full border border-stone px-3 py-1 text-ink"
              >
                {node.state}
              </li>
            ) : (
              <li key={i} className="flex items-center gap-2 text-smoke">
                <span aria-hidden="true" className="hidden sm:inline">
                  →
                </span>
                <span aria-hidden="true" className="sm:hidden">
                  ↓
                </span>
                {node.edge}
              </li>
            ),
          )}
        </ol>

        <div className="mt-14 grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:col-span-7">
            {voicePoints.map((p) => (
              <div key={p.label}>
                <dt className="text-body font-medium text-ink">{p.label}</dt>
                <dd className="mt-2 text-body-sm text-smoke">{p.body}</dd>
              </div>
            ))}
          </dl>

          <div className="lg:col-span-5">
            <p className="font-mono text-caption uppercase text-smoke">
              Defaults, from .env
            </p>
            <dl className="mt-4">
              {voiceDefaults.map((d) => (
                <div
                  key={d.key}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-stone py-3"
                >
                  <dt className="font-mono text-code text-graphite">
                    {d.key}
                  </dt>
                  <dd className="font-mono text-code text-ink">{d.value}</dd>
                  <dd className="w-full text-body-sm text-smoke">
                    {d.meaning}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
