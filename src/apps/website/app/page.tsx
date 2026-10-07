import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Cpu, Lock, CheckCircle2 } from "lucide-react";
import { AudioSphere } from "@/components/AudioSphere";
import { EngineTabs } from "@/components/EngineTabs";
import { TerminalPreview } from "@/components/TerminalPreview";
import { ComparisonTable } from "@/components/ComparisonTable";
import { VoiceTurnSimulator } from "@/components/VoiceTurnSimulator";
import { FaqAccordion } from "@/components/FaqAccordion";
import { FAQS } from "@/lib/faqsData";
import { JsonLd } from "@/components/JsonLd";

export default function HomePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQS.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };

  return (
    <>
      <JsonLd data={faqSchema} />

      {/* SECTION 1: HERO */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 px-6 overflow-hidden">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Whisper-weight Editorial Typography */}
            <div className="lg:col-span-7 space-y-8">
              {/* Top Tag Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[13px] text-[#44403b]">
                <span className="w-2 h-2 rounded-full bg-black"></span>
                <span>The Local macOS Body for Instinct</span>
              </div>

              {/* Display Headline (Waldenburg 300, -0.02em tracking, 48px+) */}
              <h1 className="text-[44px] sm:text-[56px] lg:text-[64px] font-display text-black max-w-[700px]">
                Say &ldquo;Wake up, Jarvis.&rdquo;
                <br />
                Then just talk.
              </h1>

              {/* Subhead in Inter 400 with relaxed line-height */}
              <p className="text-[17px] md:text-[19px] leading-relaxed text-[#777169] max-w-[620px]">
                OpenAgent gives <a href="https://instinct.com" target="_blank" rel="noopener noreferrer" className="text-black font-medium underline underline-offset-4 hover:opacity-80">Instinct</a> a voice interface modeled on Tony Stark&apos;s Jarvis. Speak naturally from anywhere in the room. OpenAgent carries out your requests locally: shell execution, code diffs, native apps, your authenticated Chrome, and social accounts.
              </p>

              {/* Call to Actions (DESIGN.md Pill Buttons) */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href="/docs"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full text-[14px] font-medium text-white bg-black hover:bg-[#222222] transition-colors border border-black shadow-sm"
                >
                  <span>Quick Start (`./boot.py`)</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>

                <Link
                  href="/architecture"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-full text-[14px] font-medium text-black bg-[#fdfcfc] hover:bg-[#f5f3f1] border border-[#ebe8e4] transition-colors"
                >
                  How It Works
                </Link>

                <Link
                  href="/tools"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-full text-[14px] font-medium text-[#44403b] hover:text-black transition-colors"
                >
                  Explore 55+ Tools →
                </Link>
              </div>

              {/* Key Trust Signals */}
              <div className="pt-6 border-t border-[#ebe8e4] flex flex-wrap items-center gap-6 text-[13px] text-[#777169]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Zero API Keys Needed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Offline Wake Word (Vosk)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Fail-Closed Chat Guard</span>
                </div>
              </div>
            </div>

            {/* Right Column: Signature Bauhaus Audio Sphere Visual */}
            <div className="lg:col-span-5 flex justify-center">
              <AudioSphere />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: OPEN SOURCE ECOSYSTEM BADGES */}
      <section className="w-full bg-[#f5f3f1] border-y border-[#ebe8e4] py-8 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Engineered On Open Standards
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-[13px] font-medium text-[#44403b]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                macOS Darwin (14 & 15)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                Python 3.11+ via Astral uv
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                Bun 1.1+ TypeScript
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                whisper.cpp & Vosk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                Firecrawl Engine
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                195 Passing Tests
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: THE JARVIS CONVERSATIONAL EXPERIENCE */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-[1280px] mx-auto space-y-12">
          <div className="max-w-[720px] space-y-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Continuous Hands-Free Conversation
            </div>
            <h2 className="text-[36px] md:text-[44px] font-display text-black">
              Talk while you make coffee. Jarvis handles the rest.
            </h2>
            <p className="text-[16px] leading-relaxed text-[#777169]">
              Traditional voice bots force you to wait for beeps or re-state wake words on every sentence. OpenAgent stays awake continuously. You speak, pause, and the request dispatches automatically. Context carries across turns in your verified chat.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <VoiceTurnSimulator />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-[20px] bg-[#f5f3f1] p-6 space-y-3">
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-mono text-[13px]">
                  01
                </div>
                <h3 className="text-[18px] font-medium text-black">
                  Wake once, keep talking
                </h3>
                <p className="text-[14px] text-[#777169] leading-relaxed">
                  Say &quot;Wake up, Jarvis&quot; and the session unlocks. Vosk monitors speech locally. Requests dispatch automatically after 2 seconds of natural silence.
                </p>
              </div>

              <div className="rounded-[20px] bg-[#f5f3f1] p-6 space-y-3">
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-mono text-[13px]">
                  02
                </div>
                <h3 className="text-[18px] font-medium text-black">
                  Natural audio turn-taking
                </h3>
                <p className="text-[14px] text-[#777169] leading-relaxed">
                  Instinct replies aloud through your Mac speakers. Built-in echo guards ensure Jarvis never hears or triggers its own voice feedback.
                </p>
              </div>

              <div className="rounded-[20px] bg-[#f5f3f1] p-6 space-y-3">
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-mono text-[13px]">
                  03
                </div>
                <h3 className="text-[18px] font-medium text-black">
                  Hold F8 push-to-talk fallback
                </h3>
                <p className="text-[14px] text-[#777169] leading-relaxed">
                  Working in an office or noisy café? Hold F8 to talk, release to send. Holding F8 during Jarvis&apos;s reply cuts it short instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: WHY OPENAGENT (PROBLEM & SOLUTION MATRIX) */}
      <section className="py-24 md:py-32 px-6 bg-[#f5f3f1] border-y border-[#ebe8e4]">
        <div className="max-w-[1280px] mx-auto space-y-12">
          <div className="max-w-[700px] space-y-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Closing the Desktop Gap
            </div>
            <h2 className="text-[36px] md:text-[44px] font-display text-black">
              Instinct thinks. OpenAgent acts.
            </h2>
            <p className="text-[16px] leading-relaxed text-[#777169]">
              Instinct operates in the cloud. It can touch your accounts, but it cannot touch your laptop. OpenAgent closes the gap, giving cloud intelligence a local body with native macOS keyboard, mouse, terminal, and browser control.
            </p>
          </div>

          <ComparisonTable />
        </div>
      </section>

      {/* SECTION 5: HOW IT WORKS (ZERO-API-KEY TRANSPORT) */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-[1280px] mx-auto space-y-16">
          <div className="text-center max-w-[740px] mx-auto space-y-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Transport Architecture
            </div>
            <h2 className="text-[36px] md:text-[44px] font-display text-black">
              How OpenAgent works without an API key
            </h2>
            <p className="text-[16px] leading-relaxed text-[#777169]">
              OpenAgent turns WhatsApp Desktop into a deterministic local bridge using macOS Accessibility APIs. No cloud proxies, no open inbound ports, and no API subscription costs.
            </p>
          </div>

          {/* 6-Step Visual Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <span className="text-[12px] font-mono text-[#a59f97]">STEP 01</span>
              <h3 className="text-[20px] font-medium text-black">Voice Ingestion</h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                You speak after &quot;Wake up, Jarvis&quot;. OpenAgent captures audio via SoX and attaches a voice note or local Whisper transcript to your Instinct chat.
              </p>
            </div>

            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <span className="text-[12px] font-mono text-[#a59f97]">STEP 02</span>
              <h3 className="text-[20px] font-medium text-black">JARVIS_CALL Envelope</h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                Instinct replies with structured JSON payload wrapped in a base64 envelope, preventing WhatsApp markdown from stripping symbols like asterisks and tildes.
              </p>
            </div>

            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <span className="text-[12px] font-mono text-[#a59f97]">STEP 03</span>
              <h3 className="text-[20px] font-medium text-black">AX Observation</h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                OpenAgent reads incoming messages through the macOS Accessibility tree without requiring webhooks or exposing local network ports.
              </p>
            </div>

            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <span className="text-[12px] font-mono text-[#a59f97]">STEP 04</span>
              <h3 className="text-[20px] font-medium text-black">Fail-Closed Verification</h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                A security guard verifies the message header against your configured Instinct phone number (`BRIDGE_SAFE_MODE=true`). Unverified messages are discarded.
              </p>
            </div>

            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <span className="text-[12px] font-mono text-[#a59f97]">STEP 05</span>
              <h3 className="text-[20px] font-medium text-black">Dispatcher Routing</h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                The call is parsed and routed to one of five local engines: developer harness, native Quartz/AX, browser CDP, Firecrawl, or LocoAgent.
              </p>
            </div>

            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <span className="text-[12px] font-mono text-[#a59f97]">STEP 06</span>
              <h3 className="text-[20px] font-medium text-black">Response & Voice Loop</h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                Execution diffs, stdout, and window screenshots are staged and sent back to WhatsApp. Instinct plays voice responses out loud automatically.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/architecture"
              className="inline-flex items-center gap-2 text-[14px] font-medium text-black underline underline-offset-4 hover:opacity-80"
            >
              Read the full technical Architecture & Sequence Specification →
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 6: 5 CORE ENGINES SHOWCASE */}
      <section className="py-24 md:py-32 px-6 bg-[#fdfcfc]">
        <div className="max-w-[1280px] mx-auto space-y-12">
          <div className="max-w-[700px] space-y-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Modular Architecture
            </div>
            <h2 className="text-[36px] md:text-[44px] font-display text-black">
              Five engines. Over 55 local tools.
            </h2>
            <p className="text-[16px] leading-relaxed text-[#777169]">
              Every tool is engineered for safety, atomicity, and low latency. Click through the engines below to inspect capabilities and protocol envelopes.
            </p>
          </div>

          <EngineTabs />
        </div>
      </section>

      {/* SECTION 7: ONE-COMMAND AUTONOMOUS CLI PLAYGROUND */}
      <section className="py-24 md:py-32 px-6 bg-[#f5f3f1] border-y border-[#ebe8e4]">
        <div className="max-w-[1280px] mx-auto space-y-12">
          <div className="max-w-[700px] space-y-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Zero-Touch Tooling
            </div>
            <h2 className="text-[36px] md:text-[44px] font-display text-black">
              Self-bootstrapping autonomous scripts
            </h2>
            <p className="text-[16px] leading-relaxed text-[#777169]">
              OpenAgent includes autonomous Python scripts for every lifecycle task: environment setup, preflight system audits, WhatsApp UI calibration, and test execution.
            </p>
          </div>

          <TerminalPreview />
        </div>
      </section>

      {/* SECTION 8: SECURITY & PRIVACY PROMISES */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-[1280px] mx-auto space-y-12">
          <div className="max-w-[700px] space-y-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Security By Design
            </div>
            <h2 className="text-[36px] md:text-[44px] font-display text-black">
              Your computer, guarded
            </h2>
            <p className="text-[16px] leading-relaxed text-[#777169]">
              Local agentic execution demands strict boundaries. OpenAgent is architected with defense-in-depth principles:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <Lock className="w-5 h-5 text-black" />
              <h3 className="text-[18px] font-medium text-black">
                Offline Wake Word
              </h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                Vosk runs completely on your Mac. No microphones stream to cloud providers while Jarvis is asleep. Audio records only after wake-word activation.
              </p>
            </div>

            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <ShieldCheck className="w-5 h-5 text-black" />
              <h3 className="text-[18px] font-medium text-black">
                Fail-Closed Sender Auth
              </h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                OpenAgent checks the active WhatsApp chat header before every tool invocation. Messages from unknown numbers or outside groups are rejected instantly.
              </p>
            </div>

            <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
              <Cpu className="w-5 h-5 text-black" />
              <h3 className="text-[18px] font-medium text-black">
                Anti-Duplication Ledger
              </h3>
              <p className="text-[14px] text-[#777169] leading-relaxed">
                Social posts and interactions are permanently hashed and logged. The agent cannot accidentally spam forums, repost existing items, or enter infinite loops.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: FAQ ACCORDION */}
      <section className="py-24 md:py-32 px-6 bg-[#f5f3f1] border-y border-[#ebe8e4]">
        <div className="max-w-[900px] mx-auto space-y-10">
          <div className="space-y-3">
            <div className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Questions & Answers
            </div>
            <h2 className="text-[36px] md:text-[44px] font-display text-black">
              Frequently Asked Questions
            </h2>
          </div>

          <FaqAccordion />
        </div>
      </section>

      {/* SECTION 10: BOTTOM CALL TO ACTION BANNER */}
      <section className="py-28 px-6 text-center">
        <div className="max-w-[800px] mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[13px] text-[#44403b]">
            <span>OpenAgent ⌘ · MIT License</span>
          </div>

          <h2 className="text-[40px] sm:text-[52px] font-display text-black">
            Give your AI a physical desktop.
          </h2>

          <p className="text-[17px] text-[#777169] max-w-[580px] mx-auto leading-relaxed">
            Clone the repository, run `./install.py`, and say &ldquo;Wake up, Jarvis.&rdquo; Turn Instinct into your personal Tony Stark assistant today.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-[14px] font-medium text-white bg-black hover:bg-[#222222] transition-colors border border-black shadow-sm"
            >
              <span>Get Started in 4 Minutes</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>

            <a
              href="https://github.com/GitCoder052023/OpenAgent"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-[14px] font-medium text-black bg-[#fdfcfc] hover:bg-[#f5f3f1] border border-[#ebe8e4] transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
