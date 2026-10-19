import {
  openInstinctPoints,
  repoUrl,
  tenets,
} from "@/lib/content";
import { SectionLabel, StatusTag } from "@/components/primitives";

export function Vision() {
  return (
    <section
      id="vision"
      className="scroll-mt-24 bg-night py-28 text-night-text lg:py-40"
    >
      <div className="gutter">
        <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SectionLabel tone="dark">Directional philosophy</SectionLabel>
            <p className="mt-8 text-body-lg text-night-dim">
              You might find it absurd, funny, or borderline delusional. The
              direction is unapologetically simple:
            </p>
            <h2 className="mt-6 text-heading text-eggshell lg:text-display">
              A unified infrastructure for a personal AI that is, quite
              literally, as close to Tony Stark&rsquo;s Jarvis as
              computationally possible.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:pt-32">
            <p className="text-body text-night-text">
              Not a glorified autocomplete. Not a fragile browser extension. Not
              a passive chatbot locked inside a tab. A sovereign, always-running
              companion that actually operates your computer, executes
              real-world jobs, manages your digital presence, and remembers your
              life across years.
            </p>
          </div>
        </div>

        <ol className="mt-20 grid gap-x-16 gap-y-12 lg:mt-28 lg:grid-cols-2">
          {tenets.map((tenet) => (
            <li key={tenet.n} className="border-t border-night-line pt-4">
              <div className="flex items-center justify-between gap-4">
                <span className="tabular font-mono text-code text-night-dim">
                  {tenet.n}
                </span>
                <StatusTag status={tenet.status} tone="dark" />
              </div>
              <h3 className="mt-5 text-subheading text-eggshell lg:text-heading-sm">
                {tenet.title}
              </h3>
              <p className="mt-5 text-body-sm text-night-text">{tenet.body}</p>
            </li>
          ))}
        </ol>

        {/* The convergence: two halves that are meant to become one system. */}
        <div className="mt-24 lg:mt-32">
          <SectionLabel tone="dark">The convergence</SectionLabel>
          <div className="mt-10 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <div className="rounded-card border border-night-line bg-night-raised p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-subheading text-eggshell">OpenInstinct</h3>
                <StatusTag status="experimental" tone="dark" />
              </div>
              <p className="mt-1 font-mono text-caption uppercase text-night-dim">
                the brain · local
              </p>
              <p className="mt-4 text-body-sm text-night-text">
                A terminal REPL that reasons against any local or remote
                OpenAI-compatible or Ollama endpoint, and drives the same Mac
                harness engines with live receipts — no WhatsApp, no closed
                cloud API, no telemetry.
              </p>
              <p className="mt-5 font-mono text-code text-eggshell">
                ./boot.py --brain openinstinct
              </p>
            </div>

            <div className="rounded-card border border-night-line bg-night-raised p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-subheading text-eggshell">OpenAgent</h3>
                <StatusTag status="shipping" tone="dark" />
              </div>
              <p className="mt-1 font-mono text-caption uppercase text-night-dim">
                the body · local
              </p>
              <p className="mt-4 text-body-sm text-night-text">
                The macOS execution environment described everywhere above:
                voice perception, native computer use, browser and social
                automation, documents, WhatsApp, MCP — all running on your
                hardware, under your user account.
              </p>
              <p className="mt-5 font-mono text-code text-night-dim">
                ./boot.py --voice --send-mode audio
              </p>
            </div>
          </div>

          <svg
            aria-hidden="true"
            viewBox="0 0 1000 72"
            preserveAspectRatio="none"
            className="h-14 w-full"
          >
            <path
              d="M250 0 C250 34 500 20 500 40 M750 0 C750 34 500 20 500 40 M500 40 V62"
              fill="none"
              stroke="#2b2823"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path d="M500 72 L495 60 L505 60 Z" fill="#2b2823" />
          </svg>

          <div className="rounded-card border border-night-line p-7 text-center">
            <p className="text-body-lg text-eggshell">
              Plug the two together and you have a completely open-source
              personal Jarvis that no provider can shut off, paywall or censor.
            </p>
            <p className="mx-auto mt-4 max-w-[62ch] text-body-sm text-night-dim">
              This is the stated direction, not a shipped feature. OpenInstinct
              is secondary and experimental today; Instinct remains the primary
              intelligence because its chief-of-staff experience over WhatsApp
              is the one that has been used daily.
            </p>
          </div>

          <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {openInstinctPoints.map((p) => (
              <div key={p.label} className="border-t border-night-line pt-4">
                <dt className="text-body-sm font-medium text-eggshell">
                  {p.label}
                </dt>
                <dd className="mt-2 text-body-sm text-night-dim">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-24 border-t border-night-line pt-10 lg:mt-32">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <h2 className="max-w-[20ch] text-heading text-eggshell">
                Your assistant should work for you and only you.
              </h2>
              <p className="mt-4 max-w-[56ch] text-body-sm text-night-dim">
                Keeping execution on bare metal keeps your secrets, tokens,
                private chats and files inside your own boundary. MIT licensed,
                top to bottom.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full bg-eggshell px-5 py-2.5 text-body-sm font-medium text-ink transition-colors duration-200 hover:bg-stone"
              >
                Clone the repository
              </a>
              <a
                href={`${repoUrl}/blob/main/OPENINSTINCT_BRAIN_SPEC.md`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full border border-night-line px-5 py-2.5 text-body-sm font-medium text-night-text transition-colors duration-200 hover:border-night-dim hover:text-eggshell"
              >
                Read the brain spec
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
