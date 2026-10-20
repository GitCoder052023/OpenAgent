import { repoUrl } from "@/lib/content";
import { toolCategories, toolCount } from "@/lib/tools";
import { WakeMeter } from "@/components/wake-meter";

export function Hero() {
  return (
    <section className="relative pt-24 sm:pt-32 lg:pt-40">
      <div className="gutter">
        <div className="grid items-end gap-x-16 gap-y-10 sm:gap-y-12 lg:grid-cols-12">
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

            <h1 className="mt-6 text-display-xl font-light text-ink sm:mt-7">
              Instinct thinks.
              <br />
              OpenAgent acts.
            </h1>

            <p className="mt-6 max-w-[52ch] text-body-lg text-smoke sm:mt-8">
              OpenAgent is an open-source execution environment for macOS. It
              hands an AI assistant {toolCount} callable tools on the machine in
              front of you — your shell, your authenticated Chrome, your native
              apps, your WhatsApp — behind a voice interface that runs
              on-device. A sentence you said out loud while doing something else
              becomes real work here, not in somebody&rsquo;s cloud.
            </p>

            {/* Full-width buttons on the narrowest phones, where two pills on
                one line leave neither a comfortable target. */}
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite sm:min-h-11 sm:justify-start"
              >
                Clone the repository
              </a>
              <a
                href="#transport"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-stone bg-eggshell px-5 text-body-sm font-medium text-ink transition-colors duration-200 hover:border-graphite hover:bg-taupe sm:min-h-11 sm:justify-start"
              >
                Watch a request run
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <WakeMeter />
          </div>
        </div>
      </div>
    </section>
  );
}
