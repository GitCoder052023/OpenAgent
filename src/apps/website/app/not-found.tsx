import Link from "next/link";
import { repoUrl } from "@/lib/content";
import { toolCount } from "@/lib/tools";
import { SectionLabel } from "@/components/primitives";

const destinations = [
  {
    href: "/",
    label: "Overview",
    blurb: "What OpenAgent is, how a request travels, and the engines behind it",
  },
  {
    href: "/tools",
    label: "Tool reference",
    blurb: `All ${toolCount} callable tools, grouped by engine`,
  },
  {
    href: "/faq",
    label: "FAQ",
    blurb: "Requirements, capabilities, model independence and licensing",
  },
  {
    href: "/privacy",
    label: "Privacy & security",
    blurb: "What stays local, what crosses the wire, and the safeguards",
  },
];

export default function NotFound() {
  return (
    <section className="pt-32 pb-24 lg:pt-44 lg:pb-32">
      <div className="gutter grid gap-x-16 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionLabel>404</SectionLabel>
          <h1 className="mt-6 text-heading text-ink lg:text-display">
            That page isn&rsquo;t here.
          </h1>
          <p className="mt-7 max-w-[42ch] text-body text-smoke">
            The link may be out of date, or the page may have moved. Everything
            this site holds is listed on the right — and the repository is
            always the source of truth.
          </p>
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite"
          >
            Go to the repository
          </a>
        </div>

        <nav aria-label="Site pages" className="lg:col-span-7">
          <ul>
            {destinations.map((d) => (
              <li key={d.href} className="border-t border-stone last:border-b">
                <Link
                  href={d.href}
                  className="group flex items-baseline justify-between gap-6 py-6 transition-colors duration-200 hover:bg-taupe"
                >
                  <span>
                    <span className="block text-subheading text-ink">
                      {d.label}
                    </span>
                    <span className="mt-1 block text-body-sm text-smoke">
                      {d.blurb}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-code text-ash transition-colors duration-200 group-hover:text-ink"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
