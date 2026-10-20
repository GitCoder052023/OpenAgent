import Link from "next/link";
import { repoUrl } from "@/lib/content";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { SectionLabel } from "@/components/primitives";

export const metadata = pageMetadata({
  title: "Privacy and security model",
  ogTitle: "OpenAgent privacy and security model",
  description:
    "What OpenAgent keeps on your Mac, what crosses the wire and when, what it writes to disk, and the six fail-closed safeguards around letting an AI agent run on a real computer.",
  imageAlt: "OpenAgent privacy and security model",
  path: "/privacy",
});

/* All three columns are drawn from README.md and SECURITY.md. */

const staysLocal = [
  "Idle audio. Wake-word detection runs offline on Whisper Large V3 Turbo and nothing is recorded or transmitted until the session is awake and you have spoken.",
  "Transcription, when you run in text mode. Whisper Large V3 Turbo decodes on the Apple Silicon GPU through MLX, or on whisper.cpp.",
  "Every tool call. Shell commands, file edits, clicks, keystrokes and window captures execute on your hardware under your own user account.",
  "Web scraping and crawling. Firecrawl runs as a Docker daemon you host, at an endpoint you configure.",
  "Your credentials. OpenAgent drives the Chrome profile and WhatsApp session you are already signed into; it holds no account of its own.",
];

const crossesTheWire = [
  "A voice note, or an on-device transcript, sent into your own WhatsApp thread with your assistant — only after the wake phrase and only after you have spoken a request.",
  "The results you asked for: tool output, diffs and screenshots, returned through the same thread.",
  "Whatever your chosen intelligence layer processes in its own cloud. With Instinct that is the conversation; with OpenHarness or OpenInstinct you decide, including a model on your own hardware.",
  "Requests your tools make on your behalf — a page you asked it to scrape, a post you asked it to publish.",
];

const writtenToDisk = [
  {
    path: "~/Library/Logs/OpenAgent/bridge.jsonl",
    note: "Diagnostic event log. May contain execution paths and tool names — review before sharing.",
  },
  {
    path: "~/Library/Logs/OpenAgent/processed.jsonl",
    note: "Execution ledger of message signatures and tool-call IDs, so nothing re-runs after a restart.",
  },
  {
    path: "whatsapp-mcp/data/whatsapp-bridge.db",
    note: "Multi-device session credentials and cryptographic keys for the headless WhatsApp engine.",
  },
  {
    path: "~/.openagent/memory.json",
    note: "OpenInstinct's cross-session memory: project goals, active tasks, profile facts.",
  },
  {
    path: "ax-tree.json",
    note: "Accessibility snapshots from calibration. May expose private WhatsApp content — never commit or publish it.",
  },
];

const safeguards = [
  {
    n: "01",
    title: "Strict chat destination lock",
    body: "With BRIDGE_SAFE_MODE=true, OpenAgent verifies the active WhatsApp Desktop chat against BRIDGE_WHATSAPP_NUMBER and processes messages only from that destination. Switching to another conversation makes the bridge fail closed.",
  },
  {
    n: "02",
    title: "Configurable target isolation",
    body: "The native macOS harness keeps a PROHIBITED_TARGETS list. Applications that should never be driven by the agent can be excluded by bundle identifier or name.",
  },
  {
    n: "03",
    title: "PID-targeted input",
    body: "Mouse and keyboard events are posted directly to the target application's process where supported, so background work does not move your physical cursor or steal focus.",
  },
  {
    n: "04",
    title: "Idempotency and execution ledger",
    body: "Inbound message signatures and tool-call IDs are recorded in processed.jsonl. Previously processed messages and calls are not re-executed across restarts, which reduces duplicate execution and replay risk.",
  },
  {
    n: "05",
    title: "Audio silence gating",
    body: "Voice input is measured against an RMS energy threshold before it reaches the transcription pipeline. Low-energy and accidental recordings are discarded first.",
  },
  {
    n: "06",
    title: "Agent-level operating rules",
    body: "The connected assistant is instructed to investigate before acting, prefer reversible operations, minimise access to unrelated data, treat external content as untrusted instructions, and confirm consequential actions. These complement the runtime safeguards; they do not replace them.",
  },
];

const responsibilities = [
  "Verify the bridge destination. Never point BRIDGE_WHATSAPP_NUMBER at an untrusted or shared contact.",
  "Grant permissions carefully. Accessibility, Input Monitoring, Screen Recording and Microphone are significant local capabilities.",
  "Protect accessibility snapshots. ax-tree.json may expose private WhatsApp content.",
  "Do not run as root. Shell commands run with your macOS user's privileges; avoid sudo.",
  "Protect logs. Review anything under ~/Library/Logs/OpenAgent/ before sharing it.",
  "Protect sensitive environments. Do not expose credentials, financial accounts, production infrastructure or irreplaceable data unless you accept the risk.",
];

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        graph={[
          breadcrumbJsonLd([
            { name: "OpenAgent", path: "/" },
            { name: "Privacy and security", path: "/privacy" },
          ]),
        ]}
      />

      <section className="pt-24 sm:pt-32 lg:pt-40">
        <div className="gutter">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionLabel>Privacy &amp; security</SectionLabel>
              <h1 className="mt-6 text-display text-ink">
                Where your data actually goes.
              </h1>
              <p className="mt-7 max-w-[54ch] text-body-lg text-smoke">
                OpenAgent runs on your own hardware, under your own user
                account, driving sessions you are already signed into. That is
                the privacy argument — but it is only worth anything if the
                boundaries are written down. Here they are, along with the
                safeguards, and an honest account of what can still go wrong.
              </p>
            </div>
            <div className="lg:col-span-5 lg:pt-24">
              <p className="border-l border-stone pl-5 text-body-sm text-smoke">
                This page describes how the <em>software</em> handles your data.
                This <em>website</em> is a set of static pages: no cookies, no
                analytics, no trackers, no third-party requests — the fonts are
                self-hosted at build time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="data-path" className="scroll-mt-24 py-14 sm:py-20 lg:py-28">
        <div className="gutter">
          <h2 className="max-w-[26ch] text-heading text-ink">
            Three questions, answered without hedging.
          </h2>

          <div className="mt-10 grid gap-x-12 gap-y-12 sm:mt-14 sm:gap-y-14 lg:grid-cols-3">
            <div className="min-w-0">
              <h3 className="border-t border-ink pt-4 text-subheading text-ink">
                Never leaves this Mac
              </h3>
              <ul className="mt-5 space-y-4">
                {staysLocal.map((item) => (
                  <li
                    key={item}
                    className="border-t border-stone pt-4 text-body-sm text-smoke first:border-0 first:pt-0"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className="border-t border-ink pt-4 text-subheading text-ink">
                Crosses the wire, once you speak
              </h3>
              <ul className="mt-5 space-y-4">
                {crossesTheWire.map((item) => (
                  <li
                    key={item}
                    className="border-t border-stone pt-4 text-body-sm text-smoke first:border-0 first:pt-0"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className="border-t border-ink pt-4 text-subheading text-ink">
                Written to your disk
              </h3>
              <dl className="mt-5">
                {writtenToDisk.map((item) => (
                  <div key={item.path} className="border-t border-stone py-4 first:border-0 first:pt-0">
                    <dt className="font-mono text-code text-graphite [overflow-wrap:anywhere]">
                      {item.path}
                    </dt>
                    <dd className="mt-1.5 text-body-sm text-smoke">
                      {item.note}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section id="safeguards" className="scroll-mt-24 bg-taupe py-16 sm:py-20 lg:py-32">
        <div className="gutter">
          <div className="grid gap-x-16 gap-y-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionLabel>The security model</SectionLabel>
              <h2 className="mt-6 text-heading text-ink lg:text-display">
                When execution is ambiguous, fail closed rather than guess.
              </h2>
            </div>
            <div className="lg:col-span-5 lg:pt-16">
              <p className="text-body text-smoke">
                Six architectural safeguards sit between a message arriving and
                anything running on your machine. They are documented in full in
                the repository&rsquo;s security policy.
              </p>
            </div>
          </div>

          <ol className="mt-10 grid gap-x-12 gap-y-8 sm:mt-14 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3">
            {safeguards.map((s) => (
              <li key={s.n} className="border-t border-stone pt-5">
                <div className="flex items-baseline gap-3">
                  <span className="tabular font-mono text-code text-ash">
                    {s.n}
                  </span>
                  <h3 className="text-subheading text-ink">{s.title}</h3>
                </div>
                <p className="mt-3 text-body-sm text-smoke">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="risk" className="scroll-mt-24 py-16 sm:py-20 lg:py-32">
        <div className="gutter">
          <div className="rounded-card bg-night p-6 text-night-text sm:p-10 lg:p-12">
            <SectionLabel tone="dark">The part nobody likes writing</SectionLabel>
            <h2 className="mt-6 max-w-[24ch] text-heading text-eggshell">
              Giving an AI agent access to your computer introduces real risk.
            </h2>
            <div className="mt-8 grid gap-x-16 gap-y-6 lg:grid-cols-2">
              <p className="text-body-sm text-night-text">
                OpenAgent can act with the privileges of your local user
                account: executing commands, modifying files, interacting with
                applications, controlling browser sessions and operating the
                GUI. Agents make mistakes. Bugs, unexpected model behaviour,
                prompt injection, malicious instructions or misconfiguration may
                result in unintended actions, data loss or privacy incidents.
              </p>
              <p className="text-body-sm text-night-dim">
                OpenAgent is provided &ldquo;as is&rdquo; and &ldquo;as
                available&rdquo;. You decide whether to run it, what permissions
                to grant it, and what data and accounts it can reach. Never run
                an autonomous computer-use agent in an environment where an
                unintended action could cause unacceptable damage or loss.
              </p>
            </div>
            <p className="mt-8 font-mono text-code text-night-dim">
              Active beta · security fixes apply to the latest version on main
            </p>
          </div>
        </div>
      </section>

      <section id="responsibilities" className="scroll-mt-24 pb-16 sm:pb-20 lg:pb-32">
        <div className="gutter grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel>Your side of it</SectionLabel>
            <h2 className="mt-6 text-heading text-ink">
              Six things the maintainers ask of you.
            </h2>
            <p className="mt-6 max-w-[42ch] text-body-sm text-smoke">
              Technical safeguards reduce risk. They do not remove the need to
              operate the thing carefully.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`${repoUrl}/blob/main/SECURITY.md`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite"
              >
                Full security policy
              </a>
              <Link
                href="/faq"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone bg-eggshell px-5 text-body-sm font-medium text-ink transition-colors duration-200 hover:border-graphite hover:bg-taupe"
              >
                Read the FAQ
              </Link>
            </div>
          </div>

          <ol className="lg:col-span-7">
            {responsibilities.map((item, i) => (
              <li
                key={item}
                className="flex gap-5 border-t border-stone py-5 last:border-b"
              >
                <span className="tabular shrink-0 font-mono text-code text-ash">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-body-sm text-graphite">{item}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="reporting" className="pb-16 sm:pb-20 lg:pb-32">
        <div className="gutter border-t border-stone pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-6">
            <h2 className="text-subheading text-ink">
              Reporting a vulnerability
            </h2>
            <p className="font-mono text-caption uppercase text-smoke">
              not through public issues
            </p>
          </div>
          <p className="mt-4 max-w-[70ch] text-body-sm text-smoke">
            Open a private GitHub Security Advisory via Security → Advisories →
            Report a vulnerability, or contact the maintainers directly. Include
            a description of the vulnerability and its impact, steps to
            reproduce or a minimal proof of concept, and a suggested remediation
            if you have one.
          </p>
          <a
            href={`${repoUrl}/security/advisories/new`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-mono text-code text-graphite transition-colors duration-200 hover:text-ink lg:mt-5 pointer-fine:min-h-0"
          >
            Report a vulnerability privately ↗
          </a>
        </div>
      </section>
    </>
  );
}
