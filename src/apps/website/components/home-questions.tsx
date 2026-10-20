import Link from "next/link";
import { faqEntries } from "@/lib/faq";
import { SectionLabel } from "@/components/primitives";

/**
 * The five questions people actually arrive with, answered in full on the page
 * they land on. The same strings live on /faq, which carries the FAQPage
 * structured data — this section is plain prose so the two URLs do not compete
 * for the same rich result.
 */
const FEATURED = [
  "what-is-openagent",
  "how-different",
  "system-requirements",
  "requires-instinct",
  "what-leaves-my-mac",
];

export function HomeQuestions() {
  const entries = FEATURED.map(
    (id) => faqEntries.find((e) => e.id === id)!,
  ).filter(Boolean);

  return (
    <section id="questions" className="scroll-mt-24 py-16 sm:py-20 lg:py-32">
      <div className="gutter grid gap-x-16 gap-y-8 sm:gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
          <SectionLabel>Common questions</SectionLabel>
          <h2 className="mt-5 text-heading text-ink sm:mt-6">
            The five things people ask first.
          </h2>
          <p className="mt-6 max-w-[40ch] text-body-sm text-smoke">
            {faqEntries.length - entries.length} more — on permissions,
            integrations, offline operation, licensing and how to contribute —
            are on the FAQ.
          </p>
          <Link
            href="/faq"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-stone bg-eggshell px-5 text-body-sm font-medium text-ink transition-colors duration-200 hover:border-graphite hover:bg-taupe sm:mt-8"
          >
            Read the full FAQ
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="lg:col-span-8">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="border-t border-stone py-6 last:border-b sm:py-7"
            >
              <h3 className="text-subheading text-ink">{entry.question}</h3>
              <p className="mt-3 text-body-sm text-smoke">{entry.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
