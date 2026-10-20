import { comparison } from "@/lib/content";
import { SectionLabel } from "@/components/primitives";

function Present() {
  return (
    <span className="inline-flex items-center justify-center">
      <span className="sr-only">Yes</span>
      <svg aria-hidden="true" width="13" height="10" viewBox="0 0 13 10" fill="none">
        <path
          d="M1 5.2L4.6 8.8L12 1.2"
          stroke="currentColor"
          strokeWidth="1.25"
        />
      </svg>
    </span>
  );
}

function Absent() {
  return (
    <span className="inline-flex items-center justify-center">
      <span className="sr-only">No</span>
      <span aria-hidden="true" className="block h-px w-3 bg-ash" />
    </span>
  );
}

export function TheGap() {
  return (
    <section id="gap" className="py-16 sm:py-20 lg:py-32">
      <div className="gutter grid gap-x-16 gap-y-10 sm:gap-y-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionLabel>The gap</SectionLabel>
          <h2 className="mt-5 text-heading text-ink sm:mt-6 lg:text-display">
            Your accounts are not your machine.
          </h2>
          <div className="mt-6 space-y-5 text-body text-smoke sm:mt-8">
            <p>
              Instinct is an invite-only personal assistant that works entirely
              through iMessage and WhatsApp. There is no app and no dashboard —
              you text it, send a voice note, or call it. It books appointments,
              manages travel, disputes bills, cancels subscriptions, and chases
              your deadlines without being asked twice.
            </p>
            <p>
              It also does general computer work. On virtual desktops, in its
              own cloud.
            </p>
            <p className="text-graphite">
              Which is exactly where it stops. That cloud desktop has your
              logins but not your filesystem, your calendar but not your
              terminal, your inbox but not the window you left open on the
              second monitor.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <table role="table" className="w-full border-collapse text-left max-sm:block">
            <caption className="sr-only">
              Capabilities available with Instinct alone, compared with Instinct
              running alongside OpenAgent.
            </caption>
            <thead role="rowgroup" className="max-sm:hidden">
              <tr role="row" className="border-b border-stone">
                <th
                  scope="col"
                  className="pb-3 pr-4 font-mono text-caption font-normal uppercase text-smoke"
                >
                  Capability
                </th>
                <th
                  scope="col"
                  className="w-24 pb-3 text-center font-mono text-caption font-normal uppercase text-smoke lg:w-28"
                >
                  Instinct
                </th>
                <th
                  scope="col"
                  className="w-28 rounded-t-[10px] bg-taupe pb-3 pt-3 text-center font-mono text-caption font-normal uppercase text-graphite lg:w-36"
                >
                  + OpenAgent
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="max-sm:block">
              {comparison.map((row) => (
                <tr
                  key={row.capability}
                  role="row"
                  className="border-b border-stone max-sm:block max-sm:py-3"
                >
                  <th
                    role="rowheader"
                    scope="row"
                    className="py-4 pr-4 text-body-sm font-normal text-graphite max-sm:block max-sm:pr-0 max-sm:pt-0 max-sm:pb-2"
                  >
                    {row.capability}
                  </th>
                  <td
                    role="cell"
                    className="py-4 text-center align-middle text-smoke max-sm:inline-flex max-sm:w-1/2 max-sm:items-center max-sm:gap-2 max-sm:py-0 max-sm:text-left"
                  >
                    <span
                      aria-hidden="true"
                      className="font-mono text-caption uppercase text-smoke sm:hidden"
                    >
                      Instinct
                    </span>
                    <span className="inline-flex justify-center max-sm:justify-start sm:w-full">
                      {row.instinct ? <Present /> : <Absent />}
                    </span>
                  </td>
                  <td
                    role="cell"
                    className="bg-taupe py-4 text-center align-middle text-ink max-sm:inline-flex max-sm:w-1/2 max-sm:items-center max-sm:gap-2 max-sm:bg-transparent max-sm:py-0 max-sm:text-left"
                  >
                    <span
                      aria-hidden="true"
                      className="font-mono text-caption uppercase text-graphite sm:hidden"
                    >
                      + OpenAgent
                    </span>
                    <span className="inline-flex justify-center max-sm:justify-start sm:w-full">
                      {row.withOpenAgent ? <Present /> : <Absent />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-6 font-mono text-code text-graphite">
            Instinct thinks. OpenAgent acts.
          </p>

          <p className="mt-5 max-w-[62ch] text-body-sm text-smoke">
            Not using Instinct, or want your own model?{" "}
            <a
              href="https://github.com/GitCoder052023/OpenHarness"
              target="_blank"
              rel="noreferrer noopener"
              className="text-graphite underline decoration-stone underline-offset-4 transition-colors duration-200 hover:text-ink hover:decoration-graphite"
            >
              OpenHarness
            </a>{" "}
            is the same execution engine on its own — point Claude, Gemini,
            Codex or a local Ollama model at these Mac tools, without the voice
            and WhatsApp setup.
          </p>
        </div>
      </div>
    </section>
  );
}
