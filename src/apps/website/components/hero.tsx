import { repoUrl } from "@/lib/content";
import { toolCategories, toolCount } from "@/lib/tools";
import { WakeMeter } from "@/components/wake-meter";

export function Hero() {
  return (
    <section className="relative pt-28 sm:pt-32 lg:pt-40">
      <div className="gutter">
        <div className="grid items-end gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-caption uppercase text-smoke">
              <span>macOS</span>
              <span aria-hidden="true" className="text-stone">
                /
              </span>
              <span>MIT licensed</span>
              <span aria-hidden="true" className="text-stone">
                /
              </span>
              <span>active beta</span>
            </p>

            <h1 className="mt-7 text-display-xl font-light text-ink">
              Instinct thinks.
              <br />
              OpenAgent acts.
            </h1>

            <p className="mt-8 max-w-[52ch] text-body-lg text-smoke">
              OpenAgent is an open-source execution environment for macOS. It
              hands an AI assistant {toolCount} callable tools on the machine in
              front of you — your shell, your authenticated Chrome, your native
              apps, your WhatsApp — behind a voice interface that runs
              on-device. A sentence you said out loud while doing something else
              becomes real work here, not in somebody&rsquo;s cloud.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite"
              >
                Clone the repository
              </a>
              <a
                href="#transport"
                className="inline-flex items-center gap-2 rounded-full border border-stone bg-eggshell px-5 py-2.5 text-body-sm font-medium text-ink transition-colors duration-200 hover:border-graphite hover:bg-taupe"
              >
                Watch a request run
              </a>
            </div>

            <p className="mt-6 font-mono text-code text-smoke">
              ./boot.py --voice --send-mode audio
            </p>
          </div>

          <div className="lg:col-span-5">
            <WakeMeter />
          </div>
        </div>

        <div className="mt-20 h-px bg-stone sm:mt-24" aria-hidden="true" />

        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 py-5 font-mono text-micro text-smoke">
          {toolCategories.map((c) => (
            <li key={c.slug} className="flex items-center gap-2">
              {c.label.toLowerCase()}
              <span className="tabular text-smoke">{c.tools.length}</span>
            </li>
          ))}
        </ul>

        <div className="h-px bg-stone" aria-hidden="true" />
      </div>
    </section>
  );
}
