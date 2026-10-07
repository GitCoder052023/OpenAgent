import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, ShieldAlert, Cpu } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Architecture & Transport Protocol",
  description:
    "Technical deep dive into OpenAgent's zero-API-key WhatsApp Desktop bridge, macOS Accessibility (AX) observer, base64 protocol envelopes, and offline speech pipeline.",
  alternates: {
    canonical: "https://openagent.sh/architecture",
  },
  openGraph: {
    title: "OpenAgent Architecture & Transport Protocol",
    description:
      "How OpenAgent executes local tools on macOS via WhatsApp Desktop without API keys or open ports.",
    url: "https://openagent.sh/architecture",
  },
};

export default function ArchitecturePage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "OpenAgent Architecture & WhatsApp Desktop AX Transport",
    "description":
      "Comprehensive specification of OpenAgent's bidirectional macOS communication channel, protocol envelopes, and offline speech intelligence.",
    "author": {
      "@type": "Organization",
      "name": "OpenAgent Project",
      "url": "https://openagent.sh",
    },
    "datePublished": "2026-10-07",
    "dateModified": "2026-10-08",
  };

  return (
    <div className="py-16 md:py-24 px-6">
      <JsonLd data={articleSchema} />

      <div className="max-w-[1000px] mx-auto space-y-16">
        {/* Breadcrumb / Back */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#777169] hover:text-black transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Overview</span>
          </Link>
        </div>

        {/* Title Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[12px] text-[#44403b] font-mono">
            TECHNICAL SPECIFICATION · v0.9
          </div>
          <h1 className="text-[40px] md:text-[50px] font-display text-black">
            Architecture & Transport Protocol
          </h1>
          <p className="text-[18px] leading-relaxed text-[#777169] max-w-[800px]">
            OpenAgent bridges Instinct (which reasons in the cloud) to your local macOS machine without custom cloud servers, reverse proxies, or open firewall ports. It uses WhatsApp Desktop as a secure, end-to-end encrypted transport.
          </p>
        </div>

        {/* Visual Sequence Pipeline */}
        <div className="rounded-[20px] bg-[#f5f3f1] p-8 border border-transparent space-y-6">
          <h2 className="text-[22px] font-medium text-black">
            End-to-End Execution Flow
          </h2>

          <div className="space-y-4 font-mono text-[13px]">
            <div className="p-4 rounded-[12px] bg-[#fdfcfc] border border-[#ebe8e4] flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-semibold text-black">1. Audio Input</span>
              <span className="text-[#777169]">Vosk detects &quot;Wake up, Jarvis&quot; → SoX records audio → delivers M4A voice note</span>
            </div>

            <div className="p-4 rounded-[12px] bg-[#fdfcfc] border border-[#ebe8e4] flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-semibold text-black">2. Cloud Reasoning</span>
              <span className="text-[#777169]">Instinct parses request → formats JSON tool call → base64 wraps into JARVIS_CALL</span>
            </div>

            <div className="p-4 rounded-[12px] bg-[#fdfcfc] border border-[#ebe8e4] flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-semibold text-black">3. AX Inspection</span>
              <span className="text-[#777169]">macOS Accessibility API reads WhatsApp window → regex extracts envelope</span>
            </div>

            <div className="p-4 rounded-[12px] bg-[#fdfcfc] border border-[#ebe8e4] flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-semibold text-black">4. Fail-Closed Guard</span>
              <span className="text-[#777169]">Asserts chat header matches BRIDGE_WHATSAPP_NUMBER before execution</span>
            </div>

            <div className="p-4 rounded-[12px] bg-[#fdfcfc] border border-[#ebe8e4] flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-semibold text-black">5. Engine Dispatch</span>
              <span className="text-[#777169]">Routes to Dev Harness (Bun), Mac AX, Chrome CDP, Firecrawl, or LocoAgent</span>
            </div>

            <div className="p-4 rounded-[12px] bg-[#fdfcfc] border border-[#ebe8e4] flex flex-col md:flex-row md:items-center justify-between gap-2">
              <span className="font-semibold text-black">6. Verification Return</span>
              <span className="text-[#777169]">Diffs, logs, or screenshots sent back to WhatsApp → audio reply auto-plays</span>
            </div>
          </div>
        </div>

        {/* Deep Dive 1: Protocol Envelope */}
        <section className="space-y-6">
          <h2 className="text-[28px] font-display text-black">
            The JARVIS_CALL Transport Envelope
          </h2>
          <p className="text-[16px] leading-relaxed text-[#777169]">
            WhatsApp Desktop automatically processes chat text with its own Markdown parser: words surrounded by asterisks become bold (`*bold*`), underscores become italics (`_italics_`), and tildes become strikethrough (`~strike~`). When an LLM sends code or JSON with regex patterns, WhatsApp&apos;s parser frequently mangles payloads.
          </p>
          <p className="text-[16px] leading-relaxed text-[#777169]">
            To guarantee pristine integrity, OpenAgent wraps all tool invocations inside a base64 transport envelope:
          </p>

          <div className="p-6 rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper font-mono text-[13px] space-y-4">
            <div className="text-[12px] text-[#a59f97] uppercase">Envelope Format</div>
            <div className="text-black font-semibold break-all">
              JARVIS_CALL:&lt;base64-encoded-JSON-payload&gt;:END
            </div>

            <div className="pt-2 text-[12px] text-[#a59f97] uppercase">Example Decoded JSON Payload</div>
            <pre className="p-4 rounded-[8px] bg-[#f5f3f1] text-[#44403b] overflow-x-auto">
{`{
  "tool": "edit",
  "args": {
    "path": "src/server.ts",
    "old_string": "const PORT = 3000;",
    "new_string": "const PORT = 8080;"
  }
}`}
            </pre>
          </div>
        </section>

        {/* Deep Dive 2: Fail-Closed Security Model */}
        <section className="space-y-6">
          <h2 className="text-[28px] font-display text-black">
            Fail-Closed Chat Header Assertions
          </h2>
          <p className="text-[16px] leading-relaxed text-[#777169]">
            Because OpenAgent executes real shell commands and browser automation on your machine, preventing unauthorized execution is essential. OpenAgent implements strict fail-closed safety by default:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <ShieldAlert className="w-5 h-5 text-black" />
              <h3 className="text-[18px] font-medium text-black">
                Header Verification
              </h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                Before parsing any message, OpenAgent inspects WhatsApp&apos;s UI tree to confirm the selected conversation title matches your configured phone number (`+16508702892`).
              </p>
            </div>

            <div className="p-6 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <Cpu className="w-5 h-5 text-black" />
              <h3 className="text-[18px] font-medium text-black">
                Rejection on Ambiguity
              </h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                If the window is hidden, another chat is clicked, or the phone number cannot be verified with certainty, execution is refused immediately with an audit log.
              </p>
            </div>
          </div>
        </section>

        {/* Deep Dive 3: Audio Pipeline */}
        <section className="space-y-6">
          <h2 className="text-[28px] font-display text-black">
            Offline Speech Pipeline & Echo Suppression
          </h2>
          <p className="text-[16px] leading-relaxed text-[#777169]">
            The voice architecture enables continuous conversation without cloud audio latency or microphone surveillance:
          </p>

          <ul className="space-y-3 text-[15px] text-[#44403b]">
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
              <span>
                <strong>Vosk Wake-Word Engine:</strong> Runs an offline 40MB acoustic model locally. Constantly monitors microphone audio buffer for &quot;Wake up, Jarvis&quot; using near-zero CPU.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
              <span>
                <strong>SoX Voice Activity Detection:</strong> Captures audio until a natural pause of 2.0 seconds (`BRIDGE_VOICE_SILENCE_SECONDS`), then automatically cuts and packages the clip.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
              <span>
                <strong>whisper.cpp Local STT:</strong> When configured with `BRIDGE_SEND_MODE=text`, runs 4-bit quantized Whisper models locally on Apple Silicon Metal or Intel AVX.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
              <span>
                <strong>Echo Guard:</strong> Automatically suppresses microphone input during Jarvis voice note playback so Jarvis never interrupts or loops over its own speech.
              </span>
            </li>
          </ul>
        </section>

        {/* Deep Dive 4: Bun IPC Harness */}
        <section className="space-y-6">
          <h2 className="text-[28px] font-display text-black">
            Bun + TypeScript Developer Harness
          </h2>
          <p className="text-[16px] leading-relaxed text-[#777169]">
            Rather than relying solely on Python subprocessing, OpenAgent offloads high-speed developer tasks to an isolated Bun TypeScript daemon (`src/tools/browser-harness` and `src/core/dispatcher.py`):
          </p>

          <div className="p-6 rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center font-mono text-[13px]">
              <div className="p-3 bg-[#f5f3f1] rounded-[10px]">
                <div className="text-[20px] font-bold text-black">&lt;2ms</div>
                <div className="text-[#777169] text-[11px] mt-0.5">IPC Latency</div>
              </div>
              <div className="p-3 bg-[#f5f3f1] rounded-[10px]">
                <div className="text-[20px] font-bold text-black">Atomic</div>
                <div className="text-[#777169] text-[11px] mt-0.5">Diff Verification</div>
              </div>
              <div className="p-3 bg-[#f5f3f1] rounded-[10px]">
                <div className="text-[20px] font-bold text-black">Zero-Leak</div>
                <div className="text-[#777169] text-[11px] mt-0.5">Process Isolation</div>
              </div>
            </div>
          </div>
        </section>

        {/* Next Step Navigation */}
        <div className="pt-8 border-t border-[#ebe8e4] flex items-center justify-between">
          <Link
            href="/"
            className="text-[14px] font-medium text-[#777169] hover:text-black transition-colors"
          >
            ← Home
          </Link>
          <Link
            href="/tools"
            className="text-[14px] font-medium text-black hover:opacity-80 transition-opacity"
          >
            View 55+ Local Tools Catalog →
          </Link>
        </div>
      </div>
    </div>
  );
}
