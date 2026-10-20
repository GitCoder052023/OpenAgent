import Link from "next/link";
import { repoUrl } from "@/lib/content";
import { faqEntries, faqGroups } from "@/lib/faq";
import { toolCount } from "@/lib/tools";
import {
  JsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { SectionLabel } from "@/components/primitives";

export const metadata = pageMetadata({
  title: "FAQ — requirements, privacy and models",
  ogTitle: "OpenAgent FAQ",
  description: `Answers about OpenAgent: supported macOS versions, what its ${toolCount} tools do today, what data leaves your Mac, using your own model instead of Instinct, and where OpenInstinct fits.`,
  imageAlt: "OpenAgent FAQ — requirements, privacy, models and setup",
  path: "/faq",
});

function isInternal(href: string) {
  return href.startsWith("/") || href.startsWith("#");
}

export default function FaqPage() {
  return (
    <>
      <JsonLd
        graph={[
          faqJsonLd(faqEntries, "/faq"),
          breadcrumbJsonLd([
            { name: "OpenAgent", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ]}
      />

      <section className="pt-24 sm:pt-32 lg:pt-40">
        <div className="gutter">
          <div className="grid gap-x-16 gap-y-8 pb-10 sm:gap-y-10 sm:pb-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionLabel>Questions</SectionLabel>
              <h1 className="mt-5 text-display text-ink sm:mt-6">
                OpenAgent, answered.
              </h1>
              <p className="mt-6 max-w-[54ch] text-body-lg text-smoke sm:mt-7">
                What it is, what it runs on, what it can do today, what leaves
                your machine, and which parts are still experimental. Every
                answer here tracks the repository, and anything unshipped is
                said to be unshipped.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-card bg-taupe p-5 sm:p-6">
                <p className="font-mono text-caption uppercase text-smoke">
                  In one paragraph
                </p>
                <p className="mt-4 text-body-sm text-graphite">
                  OpenAgent is an open-source, MIT-licensed execution
                  environment for macOS. It runs on your own Mac and gives an
                  AI assistant {toolCount} callable tools — your shell, your
                  files, native app control, your authenticated Chrome,
                  self-hosted scraping, social accounts, Office documents,
                  WhatsApp and any MCP server. Wake-word detection and
                  transcription run on-device, so you can drive it by voice
                  while you do something else.
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 font-mono text-micro lg:mt-5 lg:gap-y-2">
                  <Link
                    href="/tools"
                    className="flex min-h-11 items-center text-graphite hover:text-ink pointer-fine:min-h-0"
                  >
                    {toolCount} tools →
                  </Link>
                  <Link
                    href="/#architecture"
                    className="flex min-h-11 items-center text-graphite hover:text-ink pointer-fine:min-h-0"
                  >
                    architecture →
                  </Link>
                  <Link
                    href="/privacy"
                    className="flex min-h-11 items-center text-graphite hover:text-ink pointer-fine:min-h-0"
                  >
                    privacy →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <nav
            aria-label="Jump to a topic"
            className="border-y border-stone"
          >
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-0 py-1 font-mono text-micro lg:gap-y-2 lg:py-5">
              {faqGroups.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    className="flex min-h-11 items-center gap-2 text-smoke transition-colors duration-200 hover:text-ink pointer-fine:min-h-0"
                  >
                    {group.title.toLowerCase()}
                    <span className="tabular text-ash">
                      {group.entries.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {faqGroups.map((group) => (
            <section
              key={group.id}
              id={group.id}
              className="scroll-mt-24 pt-14 sm:pt-20 lg:pt-24"
            >
              <div className="grid gap-x-16 gap-y-2 sm:gap-y-3 lg:grid-cols-12">
                <h2 className="text-heading-sm text-ink lg:col-span-4">
                  {group.title}
                </h2>
                <p className="text-body-sm text-smoke lg:col-span-8">
                  {group.blurb}
                </p>
              </div>

              <div className="mt-8 sm:mt-10">
                {group.entries.map((entry) => (
                  <article
                    key={entry.id}
                    id={entry.id}
                    className="scroll-mt-28 grid gap-x-16 gap-y-3 border-t border-stone py-6 sm:gap-y-4 sm:py-8 lg:grid-cols-12"
                  >
                    <h3 className="text-subheading text-ink lg:col-span-4">
                      {entry.question}
                    </h3>
                    <div className="lg:col-span-8">
                      <p className="text-body-sm text-smoke">{entry.answer}</p>
                      {entry.links?.length ? (
                        <p className="mt-3 flex flex-wrap gap-x-5 font-mono text-micro lg:mt-4 lg:gap-y-2">
                          {entry.links.map((link) =>
                            isInternal(link.href) ? (
                              <Link
                                key={link.href}
                                href={link.href}
                                className="flex min-h-11 items-center text-graphite transition-colors duration-200 hover:text-ink pointer-fine:min-h-0"
                              >
                                {link.label} →
                              </Link>
                            ) : (
                              <a
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="flex min-h-11 items-center text-graphite transition-colors duration-200 hover:text-ink pointer-fine:min-h-0"
                              >
                                {link.label} ↗
                              </a>
                            ),
                          )}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <div className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t border-stone pt-8 sm:mt-20">
            <p className="max-w-[52ch] text-body-sm text-smoke">
              Something not answered here is usually answered in the
              repository, or worth opening an issue about.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite"
              >
                Read the repository
              </a>
              <a
                href={`${repoUrl}/issues`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone bg-eggshell px-5 text-body-sm font-medium text-ink transition-colors duration-200 hover:border-graphite hover:bg-taupe"
              >
                Open an issue
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
