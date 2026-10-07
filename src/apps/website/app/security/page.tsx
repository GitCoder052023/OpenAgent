import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock, AlertTriangle, EyeOff, Terminal, FileCode } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Security & Threat Model",
  description:
    "OpenAgent's security architecture, strict fail-closed chat verification, offline wake-word privacy model, and vulnerability reporting procedures.",
  alternates: {
    canonical: "https://openagent.sh/security",
  },
  openGraph: {
    title: "Security & Threat Model | OpenAgent",
    description:
      "How OpenAgent protects your local macOS environment with fail-closed safeguards and offline voice models.",
    url: "https://openagent.sh/security",
  },
};

export default function SecurityPage() {
  const securitySchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "OpenAgent Security Policy & Threat Model",
    "description":
      "Security safeguards and privacy architecture for OpenAgent's local macOS execution engine.",
    "publisher": {
      "@type": "Organization",
      "name": "OpenAgent Project",
      "url": "https://openagent.sh",
    },
  };

  return (
    <div className="py-16 md:py-24 px-6">
      <JsonLd data={securitySchema} />

      <div className="max-w-[1000px] mx-auto space-y-16">
        {/* Back Link */}
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
            SECURITY POLICY & THREAT MODEL
          </div>
          <h1 className="text-[40px] md:text-[50px] font-display text-black">
            Security & Privacy by Design
          </h1>
          <p className="text-[18px] leading-relaxed text-[#777169] max-w-[800px]">
            Giving an AI agent access to your terminal, filesystem, and browser requires defense-in-depth safeguards. OpenAgent is architected with strict fail-closed boundaries.
          </p>
        </div>

        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
            <Lock className="w-5 h-5 text-black" />
            <h2 className="text-[20px] font-medium text-black">
              1. Strict Fail-Closed Safe Mode
            </h2>
            <p className="text-[14px] text-[#777169] leading-relaxed">
              When `BRIDGE_SAFE_MODE=true` (the default), OpenAgent continuously asserts that the WhatsApp Desktop window matches your configured assistant number (`BRIDGE_WHATSAPP_NUMBER`). If the conversation shifts, execution halts immediately.
            </p>
          </div>

          <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
            <EyeOff className="w-5 h-5 text-black" />
            <h2 className="text-[20px] font-medium text-black">
              2. Offline Wake-Word Detection
            </h2>
            <p className="text-[14px] text-[#777169] leading-relaxed">
              Idle audio never leaves your Mac. Vosk processes microphone buffers locally on device. No audio recording or transmission occurs until the wake phrase (&quot;Wake up, Jarvis&quot;) is recognized.
            </p>
          </div>

          <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
            <Terminal className="w-5 h-5 text-black" />
            <h2 className="text-[20px] font-medium text-black">
              3. Atomic Exact-Match Edits
            </h2>
            <p className="text-[14px] text-[#777169] leading-relaxed">
              The `edit` tool requires exact chunk string matches before replacing code. If source code has diverged, the edit aborts and returns a unified diff error rather than guessing or corrupting files.
            </p>
          </div>

          <div className="p-8 rounded-[20px] bg-[#f5f3f1] space-y-3">
            <FileCode className="w-5 h-5 text-black" />
            <h2 className="text-[20px] font-medium text-black">
              4. Anti-Duplication Ledger
            </h2>
            <p className="text-[14px] text-[#777169] leading-relaxed">
              Every social action, reply, upvote, and post URL is hashed and checked against `operation-log.json`. OpenAgent prevents duplicate loops, spamming, and rate-limit violations automatically.
            </p>
          </div>
        </div>

        {/* Responsible AI Notice */}
        <div className="p-8 rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper space-y-4">
          <div className="flex items-center gap-2 text-black font-semibold text-[16px]">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>AI Computer-Use Responsibility</span>
          </div>
          <p className="text-[14px] text-[#777169] leading-relaxed">
            OpenAgent performs actions with the privileges of your local user account on macOS. Never run an autonomous computer-use agent in an environment where unintended actions could cause unrecoverable loss. Keep confidential tokens out of direct working directories, verify macOS TCC permissions, and inspect `.env` configurations.
          </p>
        </div>

        {/* Vulnerability Disclosure */}
        <section className="space-y-4">
          <h2 className="text-[26px] font-display text-black">
            Reporting a Vulnerability
          </h2>
          <p className="text-[15px] text-[#777169] leading-relaxed">
            We take the security of OpenAgent seriously. If you discover a potential vulnerability, please do not disclose it via public GitHub issues.
          </p>
          <div className="p-6 rounded-[16px] bg-[#f5f3f1] space-y-3 font-mono text-[13px] text-[#44403b]">
            <p>1. Open a private GitHub Security Advisory in the repository.</p>
            <p>2. Provide clear reproduction steps and impact description.</p>
            <p>3. Maintainers acknowledge reports promptly and coordinate responsible patches.</p>
          </div>
        </section>

        {/* Navigation */}
        <div className="pt-8 border-t border-[#ebe8e4] flex items-center justify-between">
          <Link
            href="/docs"
            className="text-[14px] font-medium text-[#777169] hover:text-black transition-colors"
          >
            ← Documentation
          </Link>
          <Link
            href="/"
            className="text-[14px] font-medium text-black hover:opacity-80 transition-opacity"
          >
            Home Overview →
          </Link>
        </div>
      </div>
    </div>
  );
}
