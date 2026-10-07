import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Documentation & Quick Start Guide",
  description:
    "Step-by-step setup guide for OpenAgent. Prerequisites, zero-touch installer, macOS permissions, WhatsApp calibration, and .env configuration reference.",
  alternates: {
    canonical: "https://openagent.sh/docs",
  },
  openGraph: {
    title: "OpenAgent Documentation & Quick Start Guide",
    description:
      "Get OpenAgent up and running on macOS in 4 minutes. Complete instructions for install.py, calibrate.py, and boot.py.",
    url: "https://openagent.sh/docs",
  },
};

export default function DocsPage() {
  const guideSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Install and Run OpenAgent on macOS",
    "description": "Zero-touch setup for OpenAgent, the local macOS body for Instinct.",
    "step": [
      {
        "@type": "HowToStep",
        "name": "Clone Repository",
        "text": "Clone the OpenAgent git repository from GitHub.",
      },
      {
        "@type": "HowToStep",
        "name": "Run Zero-Touch Installer",
        "text": "Run ./install.py to configure uv venv, install bun modules, and download speech models.",
      },
      {
        "@type": "HowToStep",
        "name": "Calibrate WhatsApp Desktop",
        "text": "Run ./calibrate.py --save to auto-detect UI coordinates and selectors.",
      },
      {
        "@type": "HowToStep",
        "name": "Launch Autonomous Supervisor",
        "text": "Run ./boot.py --voice --send-mode audio to start hands-free voice sessions.",
      },
    ],
  };

  return (
    <div className="py-16 md:py-24 px-6">
      <JsonLd data={guideSchema} />

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
            GETTING STARTED · SETUP MANUAL
          </div>
          <h1 className="text-[40px] md:text-[50px] font-display text-black">
            Documentation & Quick Start
          </h1>
          <p className="text-[18px] leading-relaxed text-[#777169] max-w-[800px]">
            Follow this guide to install OpenAgent, grant macOS permissions, calibrate WhatsApp Desktop, and connect Instinct.
          </p>
        </div>

        {/* Prerequisites */}
        <section className="space-y-6">
          <h2 className="text-[26px] font-display text-black">Prerequisites</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
            <div className="p-4 rounded-[16px] bg-[#f5f3f1] space-y-1.5">
              <span className="font-semibold text-black">Operating System</span>
              <p className="text-[#777169]">macOS 14 (Sonoma) or macOS 15 (Sequoia) on Apple Silicon (M1-M4) or Intel.</p>
            </div>
            <div className="p-4 rounded-[16px] bg-[#f5f3f1] space-y-1.5">
              <span className="font-semibold text-black">Astral uv & Bun</span>
              <p className="text-[#777169]">Fast Python manager `uv` and JavaScript runtime `bun` (auto-installed if missing).</p>
            </div>
            <div className="p-4 rounded-[16px] bg-[#f5f3f1] space-y-1.5">
              <span className="font-semibold text-black">Homebrew</span>
              <p className="text-[#777169]">Required to provision command-line dependencies (`sox`, `ffmpeg`, `ripgrep`).</p>
            </div>
            <div className="p-4 rounded-[16px] bg-[#f5f3f1] space-y-1.5">
              <span className="font-semibold text-black">WhatsApp Desktop</span>
              <p className="text-[#777169]">Official macOS client installed and logged in with your active Instinct chat.</p>
            </div>
          </div>
        </section>

        {/* 4-Step Quickstart */}
        <section className="space-y-6">
          <h2 className="text-[26px] font-display text-black">Installation in 4 Steps</h2>

          <div className="space-y-4">
            <div className="p-6 rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper space-y-3">
              <div className="flex items-center gap-2 font-mono text-[13px]">
                <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[11px]">1</span>
                <span className="font-semibold text-black">Clone the repository</span>
              </div>
              <pre className="p-3 bg-[#f5f3f1] rounded-[8px] font-mono text-[13px] text-[#44403b] overflow-x-auto">
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent
              </pre>
            </div>

            <div className="p-6 rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper space-y-3">
              <div className="flex items-center gap-2 font-mono text-[13px]">
                <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[11px]">2</span>
                <span className="font-semibold text-black">Run Zero-Touch System Installer</span>
              </div>
              <p className="text-[14px] text-[#777169]">
                Provisions virtual environment with `uv`, installs Bun dependencies, downloads Vosk and Whisper speech models.
              </p>
              <pre className="p-3 bg-[#f5f3f1] rounded-[8px] font-mono text-[13px] text-[#44403b] overflow-x-auto">
./install.py
              </pre>
            </div>

            <div className="p-6 rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper space-y-3">
              <div className="flex items-center gap-2 font-mono text-[13px]">
                <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[11px]">3</span>
                <span className="font-semibold text-black">Auto-Calibrate WhatsApp Desktop</span>
              </div>
              <p className="text-[14px] text-[#777169]">
                Inspects your open WhatsApp client, detects Accessibility tree paths, and saves verified selectors into `.env`.
              </p>
              <pre className="p-3 bg-[#f5f3f1] rounded-[8px] font-mono text-[13px] text-[#44403b] overflow-x-auto">
./calibrate.py --save
              </pre>
            </div>

            <div className="p-6 rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper space-y-3">
              <div className="flex items-center gap-2 font-mono text-[13px]">
                <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[11px]">4</span>
                <span className="font-semibold text-black">Launch Autonomous Jarvis Supervisor</span>
              </div>
              <p className="text-[14px] text-[#777169]">
                Starts the agent with continuous offline wake-word listener enabled:
              </p>
              <pre className="p-3 bg-[#f5f3f1] rounded-[8px] font-mono text-[13px] text-[#44403b] overflow-x-auto">
./boot.py --voice --send-mode audio
              </pre>
            </div>
          </div>
        </section>

        {/* macOS Permissions */}
        <section className="space-y-6">
          <h2 className="text-[26px] font-display text-black">macOS Privacy & Permissions</h2>
          <p className="text-[15px] text-[#777169]">
            Open <strong>System Settings → Privacy & Security</strong> and verify permissions for your Terminal / IDE:
          </p>

          <div className="p-6 rounded-[20px] bg-[#f5f3f1] space-y-3 text-[14px]">
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Accessibility:</strong> WhatsApp UI tree inspection and native computer clicks.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Input Monitoring:</strong> Global push-to-talk hotkey (`F8`) detection.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Microphone:</strong> Audio recording via SoX CoreAudio driver.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Screen Recording:</strong> Window screenshot capture (`mac_see`).</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Automation:</strong> System Events and osascript control.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Configuration Reference */}
        <section className="space-y-6">
          <h2 className="text-[26px] font-display text-black">Environment Variables (`.env`)</h2>

          <div className="rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[13px] border-collapse">
                <thead>
                  <tr className="bg-[#f5f3f1] border-b border-[#ebe8e4] text-[#44403b]">
                    <th className="p-3.5">Variable</th>
                    <th className="p-3.5">Default</th>
                    <th className="p-3.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebe8e4] text-[#44403b]">
                  <tr>
                    <td className="p-3.5 font-semibold text-black">BRIDGE_WHATSAPP_NUMBER</td>
                    <td className="p-3.5 text-[#777169]">+16508702892</td>
                    <td className="p-3.5">Verified Instinct assistant phone number</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-black">BRIDGE_SAFE_MODE</td>
                    <td className="p-3.5 text-[#777169]">true</td>
                    <td className="p-3.5">Strictly fail-closed verification against chat header</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-black">BRIDGE_HOTKEY</td>
                    <td className="p-3.5 text-[#777169]">f8</td>
                    <td className="p-3.5">Push-to-talk hotkey fallback</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-black">BRIDGE_SEND_MODE</td>
                    <td className="p-3.5 text-[#777169]">audio</td>
                    <td className="p-3.5">`audio` (AAC voice note) or `text` (Whisper STT)</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-black">BRIDGE_VOICE_SILENCE_SECONDS</td>
                    <td className="p-3.5 text-[#777169]">2.0</td>
                    <td className="p-3.5">Silence duration before auto-submitting speech</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-black">LOCOAGENT_ENABLED</td>
                    <td className="p-3.5 text-[#777169]">true</td>
                    <td className="p-3.5">Enable Threads and Reddit social automation</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-black">FIRECRAWL_API_URL</td>
                    <td className="p-3.5 text-[#777169]">http://localhost:3002</td>
                    <td className="p-3.5">Self-hosted Firecrawl Docker daemon endpoint</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Next Step */}
        <div className="pt-8 border-t border-[#ebe8e4] flex items-center justify-between">
          <Link
            href="/architecture"
            className="text-[14px] font-medium text-[#777169] hover:text-black transition-colors"
          >
            ← Architecture Deep Dive
          </Link>
          <Link
            href="/security"
            className="text-[14px] font-medium text-black hover:opacity-80 transition-opacity"
          >
            Security & Threat Model →
          </Link>
        </div>
      </div>
    </div>
  );
}
