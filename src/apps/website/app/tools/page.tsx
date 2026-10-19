import Link from "next/link";
import { repoUrl } from "@/lib/content";
import { toolCategories, toolCount } from "@/lib/tools";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { SectionLabel } from "@/components/primitives";
import { ToolExplorer } from "@/components/tool-explorer";

export const metadata = pageMetadata({
  title: `Tool reference — ${toolCount} macOS tools`,
  ogTitle: "OpenAgent tool reference",
  description: `All ${toolCount} tools OpenAgent exposes to an AI assistant on macOS, with the arguments each one takes: shell and files, native app control, Chrome, web scraping, social, Office documents, WhatsApp and MCP.`,
  imageAlt: `OpenAgent tool reference — all ${toolCount} tools across nine engines`,
  path: "/tools",
});

export default function ToolsPage() {
  return (
    <>
      <JsonLd
        graph={[
          breadcrumbJsonLd([
            { name: "OpenAgent", path: "/" },
            { name: "Tool reference", path: "/tools" },
          ]),
        ]}
      />

      <section className="pt-28 sm:pt-32 lg:pt-40">
        <div className="gutter">
          <div className="grid gap-x-16 gap-y-10 pb-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionLabel>Reference</SectionLabel>
              <h1 className="mt-6 text-display text-ink">
                {toolCount} tools, nine engines.
              </h1>
              <p className="mt-7 max-w-[54ch] text-body-lg text-smoke">
                This is the complete surface a connected assistant can reach on
                your Mac: {toolCount} callable tools spanning the shell, the
                macOS Accessibility API, the Chrome DevTools Protocol and the
                Model Context Protocol. Each entry is a real adapter in the
                repository, and every one is invoked the same way: structured
                JSON, base64 encoded, wrapped in a transport envelope.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={`${repoUrl}/blob/main/docs/JARVIS_INSTRUCTIONS.md`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite"
                >
                  Full schema specifications
                </a>
                <Link
                  href="/#architecture"
                  className="inline-flex items-center gap-2 rounded-full border border-stone bg-eggshell px-5 py-2.5 text-body-sm font-medium text-ink transition-colors duration-200 hover:border-graphite hover:bg-taupe"
                >
                  How a call travels
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-card bg-taupe p-6">
                <p className="font-mono text-caption uppercase text-smoke">
                  The envelope
                </p>
                <p className="mt-4 break-all font-mono text-micro leading-relaxed text-graphite">
                  <span className="text-ink">JARVIS_CALL:</span>
                  eyJ0b29sIjogImJhc2giLCAiYXJncyI6IHsiY29tbWFuZCI6ICJnaXQgc3RhdHVzIn19
                  <span className="text-ink">:END</span>
                </p>
                <div className="my-4 h-px bg-stone" aria-hidden="true" />
                <p className="break-all font-mono text-micro text-graphite">
                  <span aria-hidden="true" className="mr-2 text-spark">
                    ↳
                  </span>
                  {`{"tool": "bash", "args": {"command": "git status"}}`}
                </p>
                <p className="mt-5 text-body-sm text-smoke">
                  Base64 is not obfuscation. WhatsApp&rsquo;s markdown eats{" "}
                  <span className="font-mono text-code">*</span>,{" "}
                  <span className="font-mono text-code">_</span> and{" "}
                  <span className="font-mono text-code">~</span>; the base64
                  alphabet contains none of them, so a call always arrives
                  intact.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="gutter">
        <nav aria-label="Jump to an engine" className="border-t border-stone">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5 font-mono text-micro">
            {toolCategories.map((c) => (
              <li key={c.slug}>
                <a
                  href={`#${c.slug}`}
                  className="flex items-center gap-2 text-smoke transition-colors duration-200 hover:text-ink"
                >
                  {c.label.toLowerCase()}
                  <span className="tabular text-ash">{c.tools.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ToolExplorer />
    </>
  );
}
