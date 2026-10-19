import { loopSteps } from "@/lib/content";
import { SectionLabel } from "@/components/primitives";
import { FlowDiagram } from "@/components/flow-diagram";

export function Architecture() {
  return (
    <section id="architecture" className="scroll-mt-24 py-24 lg:py-32">
      <div className="gutter">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-6 text-heading text-ink lg:text-display">
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

        <div className="mt-16 hidden lg:block">
          <FlowDiagram />
        </div>

        <ol className="mt-16 grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {loopSteps.map((step) => (
            <li key={step.n} className="border-t border-stone pt-5">
              <div className="flex items-baseline gap-3">
                <span className="tabular font-mono text-code text-ash">
                  {step.n}
                </span>
                <h3 className="text-subheading text-ink">{step.title}</h3>
              </div>
              <p className="mt-3 text-body-sm text-smoke">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
