import { installSteps, permissions, prerequisites } from "@/lib/content";
import { SectionLabel } from "@/components/primitives";
import { CopyButton } from "@/components/copy-button";

export function QuickStart() {
  return (
    <section id="install" className="scroll-mt-24 pb-16 sm:pb-20 lg:pb-32">
      <div className="gutter">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel>Install</SectionLabel>
            <h2 className="mt-5 text-heading text-ink sm:mt-6 lg:text-display">
              Four commands, then say it out loud.
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-16">
            <p className="text-body text-smoke">
              boot.py provisions its own environment, resolves missing Homebrew
              and Bun dependencies, downloads the speech model, supervises the
              agent with exponential backoff and keeps WhatsApp Desktop alive in
              the background.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-x-16 gap-y-10 sm:mt-14 sm:gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rounded-card bg-night p-4 sm:p-6 lg:p-7">
              <ol>
                {installSteps.map((step, i) => (
                  <li
                    key={step.n}
                    className={`border-night-line py-4 first:pt-0 last:pb-0 ${
                      i === installSteps.length - 1 ? "" : "border-b"
                    }`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span aria-hidden="true" className="font-mono text-code text-spark">
                        $
                      </span>
                      <code className="min-w-0 flex-1 font-mono text-code text-eggshell [overflow-wrap:anywhere]">
                        {step.command}
                      </code>
                      <CopyButton value={step.command} />
                    </div>
                    <p className="mt-2 pl-6 font-mono text-micro text-night-dim">
                      {step.caption}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-5 font-mono text-code text-graphite">
              ./boot.py --doctor runs a zero-touch preflight audit of hardware,
              harnesses and permissions.
            </p>
          </div>

          <div className="space-y-12 lg:col-span-5">
            <div>
              <p className="font-mono text-caption uppercase text-smoke">
                Before you start
              </p>
              <ul className="mt-4">
                {prerequisites.map((item) => (
                  <li
                    key={item}
                    className="border-t border-stone py-3 text-body-sm text-graphite"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-mono text-caption uppercase text-smoke">
                macOS permissions it will ask for
              </p>
              <dl className="mt-4">
                {permissions.map((p) => (
                  <div
                    key={p.name}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-stone py-3"
                  >
                    <dt className="text-body-sm text-ink">{p.name}</dt>
                    <dd className="font-mono text-micro text-smoke">
                      {p.reason}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-body-sm text-smoke">
                Every one of these is granted to your terminal, by you, on your
                own machine. Nothing is requested on your behalf.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
