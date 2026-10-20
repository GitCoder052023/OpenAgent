import { loopSteps } from "@/lib/content";
import { SectionLabel } from "@/components/primitives";
import { FlowDiagram, FlowDiagramCompact } from "@/components/flow-diagram";

/**
 * One list of steps, two compositions.
 *
 * On a laptop the wide flow diagram carries the spatial argument and the steps
 * sit beneath it as a three-column index. Below that the diagram is rebuilt
 * rather than shrunk: the same loop runs down the page instead of across it,
 * in flow layout, so its labels never scale below their real size.
 */
export function Architecture() {
  return (
    <section
      id="architecture"
      className="scroll-mt-24 py-16 sm:py-20 lg:py-32"
    >
      <div className="gutter">
        <div className="grid gap-x-16 gap-y-6 sm:gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-5 text-heading text-ink sm:mt-6 lg:text-display">
              No API key. No hosted backend.
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-20">
            <p className="text-body text-smoke">
              WhatsApp Desktop is the transport because it is already on your
              Mac and already authenticated. The Accessibility API reads the
              thread, base64 keeps the payload intact through WhatsApp&rsquo;s
              markdown, and nothing executes until the message is proven to have
              come from the verified Instinct chat.
            </p>
          </div>
        </div>

        <div className="mt-10 sm:mt-14 lg:mt-16">
          <div className="hidden xl:block">
            <FlowDiagram />
          </div>
          <FlowDiagramCompact />
        </div>

        <ol className="mt-10 grid gap-x-12 gap-y-8 sm:mt-14 sm:grid-cols-2 sm:gap-y-9 lg:mt-20 lg:grid-cols-3">
          {loopSteps.map((step) => (
            <li key={step.n} className="border-t border-stone pt-4 sm:pt-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tabular font-mono text-code text-ash">
                  {step.n}
                </span>
                <h3 className="text-subheading text-ink">{step.title}</h3>
                <span className="font-mono text-caption uppercase text-smoke sm:hidden">
                  {step.where === "cloud" ? "cloud" : "this Mac"}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-smoke sm:mt-3">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
