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
    <section id="gap" className="py-24 lg:py-32">
      <div className="gutter grid gap-x-16 gap-y-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionLabel>The gap</SectionLabel>
          <h2 className="mt-6 text-heading text-ink lg:text-display">
            Your accounts are not your machine.
          </h2>
          <div className="mt-8 space-y-5 text-body text-smoke">
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
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Capabilities available with Instinct alone, compared with Instinct
              running alongside OpenAgent.
            </caption>
            <thead>
              <tr className="border-b border-stone">
                <th
                  scope="col"
                  className="pb-3 pr-4 font-mono text-caption font-normal uppercase text-smoke"
                >
                  Capability
                </th>
                <th
                  scope="col"
                  className="w-20 pb-3 text-center font-mono text-caption font-normal uppercase text-smoke sm:w-28"
                >
                  Instinct
                </th>
                <th
                  scope="col"
                  className="w-24 rounded-t-[10px] bg-taupe pb-3 pt-3 text-center font-mono text-caption font-normal uppercase text-graphite sm:w-36"
                >
                  + OpenAgent
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.capability} className="border-b border-stone">
                  <th
                    scope="row"
                    className="py-4 pr-4 text-body-sm font-normal text-graphite"
                  >
                    {row.capability}
                  </th>
                  <td className="py-4 text-center align-middle text-smoke">
                    <span className="inline-flex w-full justify-center">
                      {row.instinct ? <Present /> : <Absent />}
                    </span>
                  </td>
                  <td className="bg-taupe py-4 text-center align-middle text-ink">
                    <span className="inline-flex w-full justify-center">
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
        </div>
      </div>
    </section>
  );
}
