import Link from "next/link";
import { engines } from "@/lib/content";
import { toolCategories, toolCount } from "@/lib/tools";
import { SectionLabel } from "@/components/primitives";

const counts = new Map(toolCategories.map((c) => [c.slug, c.tools.length]));

export function Engines() {
  return (
    <section id="engines" className="scroll-mt-24 pb-24 lg:pb-32">
      <div className="gutter">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionLabel>Engines</SectionLabel>
            <h2 className="mt-6 text-heading text-ink lg:text-display">
              Eleven engines. {toolCount} tools. One dispatcher.
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-16">
            <p className="text-body text-smoke">
              Each engine is an adapter in the repository, not a category on a
              marketing page. A decoded call is routed to exactly one of them
              and run under your own user account.
            </p>
          </div>
        </div>

        <ul className="mt-14">
          {engines.map((engine, i) => {
            const count = engine.categorySlug
              ? counts.get(engine.categorySlug)
              : undefined;

            const body = (
              <div className="grid gap-x-10 gap-y-3 lg:grid-cols-12">
                <div className="flex items-baseline gap-4 lg:col-span-4">
                  <span className="tabular font-mono text-code text-ash">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-subheading text-ink lg:text-heading-sm">
                    {engine.name}
                  </h3>
                </div>
                <p className="text-body-sm text-smoke lg:col-span-5">
                  {engine.provides}
                </p>
                <div className="lg:col-span-3 lg:text-right">
                  <p className="font-mono text-code text-graphite">
                    {engine.builtOn}
                  </p>
                  <p className="mt-1 font-mono text-caption uppercase text-smoke">
                    {count !== undefined
                      ? `${count} tools`
                      : (engine.note ?? "")}
                    {count !== undefined ? (
                      <span className="ml-2 text-smoke opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                        reference →
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={engine.name} className="border-t border-stone last:border-b">
                {engine.categorySlug ? (
                  <Link
                    href={`/tools#${engine.categorySlug}`}
                    className="group block py-7 transition-colors duration-200 hover:bg-taupe"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="py-7">{body}</div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-[48ch] text-body-sm text-smoke">
            Instinct calls a tool by wrapping structured JSON in the transport
            envelope. The full schema for every one of them lives in the
            repository.
          </p>
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 rounded-full border border-stone bg-eggshell px-5 py-2.5 text-body-sm font-medium text-ink transition-colors duration-200 hover:border-graphite hover:bg-taupe"
          >
            Full tool reference
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
