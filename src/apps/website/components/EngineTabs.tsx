"use client";

import React, { useState } from "react";
import { Terminal, Mic, Monitor, Globe, Database, Share2, Check, ArrowRight } from "lucide-react";
import Link from "next/link";

interface EngineData {
  id: string;
  name: string;
  icon: React.ElementType;
  builtOn: string;
  tagline: string;
  description: string;
  capabilities: string[];
  sampleEnvelope: string;
  toolCount: number;
}

const ENGINES: EngineData[] = [
  {
    id: "dev-harness",
    name: "Developer Harness",
    icon: Terminal,
    builtOn: "Bun + TypeScript + zsh",
    tagline: "Atomic file editing, exact chunk replacement, ripgrep search, and sandboxed bash execution",
    description:
      "Gives Instinct a full engineering environment on your Mac. Unlike naive execution, edits are validated through exact string matching with unified diffs to prevent catastrophic hallucinations.",
    capabilities: [
      "Sandboxed bash in zsh with timeout guards",
      "Exact chunk search-and-replace with atomic verification",
      "ripgrep multi-threaded regex search across entire repositories",
      "Native AppleScript execution via osascript bridge"
    ],
    sampleEnvelope: `JARVIS_CALL:eyJ0b29sIjoiZWRpdCIsImFyZ3MiOnsicGF0aCI6InNyYy9tYWluLnRzIiwib2xkX3N0cmluZyI6ImNvbnN0IFBPUlQgPSAzMDAwOyIsIm5ld19zdHJpbmciOiJjb25zdCBQT1JUID0gODA4MDsifX0=:END`,
    toolCount: 8
  },
  {
    id: "voice",
    name: "Voice Interface",
    icon: Mic,
    builtOn: "Vosk + whisper.cpp + SoX",
    tagline: "Always-listening offline wake word, hands-free turn taking, and auto-reply playback",
    description:
      "Tony Stark style continuous conversation. Wake word runs completely offline on Apple Silicon / Intel with zero idle audio transmission. Sends requests after natural conversational pauses.",
    capabilities: [
      "Offline wake word ('Wake up, Jarvis') with zero latency",
      "Silence-based automatic turn-taking via SoX voice activity detection",
      "Echo guard prevents Jarvis from hearing its own voice output",
      "Push-to-talk F8 hotkey fallback for noisy or shared environments"
    ],
    sampleEnvelope: `[Voice Note Audio M4A / 16kHz Mono AAC delivered to WhatsApp]`,
    toolCount: 4
  },
  {
    id: "native-mac",
    name: "Native Computer Use",
    icon: Monitor,
    builtOn: "macOS Accessibility & Quartz",
    tagline: "Window capture, Accessibility tree queries, PID clicks and keystrokes without stealing focus",
    description:
      "Direct desktop agency that doesn't hijack your cursor. OpenAgent interacts with native macOS applications by dispatching synthetic events straight to target window processes.",
    capabilities: [
      "Targeted clicks by Process ID that don't steal user focus",
      "Full macOS Accessibility (AX) tree discovery and button triggers",
      "High-resolution window-specific screenshots via mac_see",
      "Compound multi-step UI automation in local Python (<200ms)"
    ],
    sampleEnvelope: `{"tool": "mac_click", "args": {"x": 420, "y": 780, "app": "WhatsApp", "button": "left"}}`,
    toolCount: 10
  },
  {
    id: "browser-cdp",
    name: "Real Browser Control",
    icon: Globe,
    builtOn: "Browser Harness (CDP)",
    tagline: "Drives your everyday authenticated Chrome profile with shadow DOM & iframe piercing",
    description:
      "Unlike sandboxed headless browsers that trigger captchas, OpenAgent drives your real Chrome profile with all your logged-in cookies, passwords, and extensions intact.",
    capabilities: [
      "Compositor clicks that pierce shadow DOM and nested iframes",
      "Framework-safe form input triggering React/Vue synthetic events",
      "97 site-specific pre-built domain automation skills",
      "Background tab management marked with horse emoji (🐎)"
    ],
    sampleEnvelope: `{"tool": "browser_fill", "args": {"selector": "input[name='q']", "text": "OpenAgent macOS"}}`,
    toolCount: 14
  },
  {
    id: "web-ingestion",
    name: "Web Ingestion",
    icon: Database,
    builtOn: "Self-Hosted Firecrawl (Docker)",
    tagline: "Dynamic page scraping to clean LLM markdown, recursive crawls, and schema extraction",
    description:
      "Turns the web into structured, token-efficient LLM context. Runs locally inside a Docker daemon so no data or scrapers rely on third-party cloud APIs.",
    capabilities: [
      "Clean LLM Markdown extraction stripping ads and navigation bloat",
      "Single-shot search returning full markdown content from top hits",
      "Recursive documentation crawling with configurable depth limits",
      "Strict schema-based JSON entity extraction"
    ],
    sampleEnvelope: `{"tool": "firecrawl_scrape", "args": {"url": "https://docs.github.com", "formats": ["markdown"]}}`,
    toolCount: 7
  },
  {
    id: "social-automation",
    name: "Social Automation",
    icon: Share2,
    builtOn: "LocoAgent (CDP)",
    tagline: "Autonomous posting, replying, and engagement on Threads & Reddit with anti-bot isolation",
    description:
      "Dedicated persistent Chrome profiles on dedicated CDP ports (Threads: 9227, Reddit: 9224). All actions are permanently recorded into an anti-duplication ledger to prevent spamming.",
    capabilities: [
      "Primary channels: Threads (threads.net) and Reddit (reddit.com)",
      "Anti-duplication ledger hashes all interactions before execution",
      "Live feed screenshot verification delivered directly to WhatsApp",
      "Autonomous mission delegation with natural language prompts"
    ],
    sampleEnvelope: `{"tool": "social_post", "args": {"platform": "threads", "text": "Shipped new voice engine in OpenAgent ⌘"}}`,
    toolCount: 13
  }
];

export function EngineTabs() {
  const [activeEngine, setActiveEngine] = useState(ENGINES[0]);

  return (
    <div className="w-full">
      {/* Engine Selection Tab Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none">
        {ENGINES.map((engine) => {
          const Icon = engine.icon;
          const isSelected = activeEngine.id === engine.id;
          return (
            <button
              key={engine.id}
              type="button"
              onClick={() => setActiveEngine(engine)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium transition-all shrink-0 ${
                isSelected
                  ? "bg-black text-white shadow-sm"
                  : "bg-[#f5f3f1] text-[#44403b] hover:bg-[#ebe8e4] border border-[#ebe8e4]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{engine.name}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? "bg-white/20 text-white" : "bg-[#ebe8e4] text-[#777169]"
                }`}
              >
                {engine.toolCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Engine Detail Card (20px radius, taupe fill, DESIGN.md specs) */}
      <div className="mt-4 rounded-[20px] bg-[#f5f3f1] p-8 border border-transparent shadow-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Details */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-mono text-[#777169]">
                <span>BUILT ON</span>
                <span className="text-black font-semibold">{activeEngine.builtOn}</span>
              </div>
              <h3 className="text-[26px] md:text-[32px] font-display text-black">
                {activeEngine.name}
              </h3>
              <p className="text-[15px] leading-relaxed text-[#777169]">
                {activeEngine.description}
              </p>
            </div>

            {/* Capabilities List */}
            <div className="space-y-2.5 pt-2">
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
                Key Primitives
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeEngine.capabilities.map((cap, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[13px] text-[#44403b] bg-[#fdfcfc] p-3 rounded-[12px] border border-[#ebe8e4]"
                  >
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/tools"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-black hover:opacity-75 transition-opacity"
              >
                <span>Explore all {activeEngine.toolCount} {activeEngine.name} tools in catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Right Protocol Preview Box */}
          <div className="lg:col-span-5 bg-[#fdfcfc] rounded-[16px] border border-[#ebe8e4] p-5 shadow-whisper space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#777169] pb-2 border-b border-[#ebe8e4]">
              <span>PROTOCOL TRANSPORT</span>
              <span className="text-emerald-700 bg-[#f5f3f1] px-2 py-0.5 rounded">
                SAFE_MODE: ON
              </span>
            </div>

            <div className="space-y-2 font-mono text-[12px]">
              <span className="text-[#a59f97] text-[11px]">Payload Structure</span>
              <div className="p-3 bg-[#f5f3f1] rounded-[8px] text-[#44403b] break-all leading-relaxed">
                {activeEngine.sampleEnvelope}
              </div>
            </div>

            <div className="text-[12px] text-[#777169] leading-normal pt-1">
              Encapsulated inside WhatsApp markdown-safe envelope. Base64 encoding protects brackets and characters from messaging formatting corruption.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
