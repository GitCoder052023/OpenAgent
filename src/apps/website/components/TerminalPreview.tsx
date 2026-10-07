"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface ScriptTab {
  id: string;
  command: string;
  title: string;
  badge: string;
  output: string[];
}

const TABS: ScriptTab[] = [
  {
    id: "boot",
    command: "./boot.py --voice --send-mode audio",
    title: "Autonomous Boot",
    badge: "Supervisor Watchdog",
    output: [
      "[boot] OpenAgent Autonomous Supervisor initializing...",
      "[runtime] Auto-detected macOS Darwin (Apple Silicon arm64)",
      "[uv] Environment .venv active, dependencies synchronized",
      "[models] Checking speech intelligence: vosk-model-small-en, ggml-base.bin [OK]",
      "[watchdog] Launching WhatsApp Desktop in background...",
      "[bridge] Fail-closed chat verification: +16508702892 matched",
      "[voice] Vosk wake-word listener standing by (say 'Wake up, Jarvis')...",
      "[ready] OpenAgent running with exponential backoff supervisor PID: 48192"
    ]
  },
  {
    id: "doctor",
    command: "./boot.py --doctor",
    title: "Preflight Doctor",
    badge: "Hardware & Permissions",
    output: [
      "[doctor] Starting preflight system audit...",
      "✓ macOS Version: macOS 15.3 (Darwin 24.3.0)",
      "✓ Python Runtime: Python 3.12.2 (via uv)",
      "✓ Bun Runtime: Bun 1.1.27 (/opt/homebrew/bin/bun)",
      "✓ Audio Recording: SoX & CoreAudio default input active",
      "✓ macOS Accessibility (AX): Terminal granted AXIsProcessTrusted",
      "✓ Screen Recording: TCC screen capture permission verified",
      "✓ Chrome CDP: Chrome installed, debugging interface reachable",
      "✓ WhatsApp Desktop: UI accessibility nodes calibrated",
      "[doctor] All 8 preflight checks passed. Ready to boot."
    ]
  },
  {
    id: "install",
    command: "./install.py",
    title: "Zero-Touch Install",
    badge: "One Command",
    output: [
      "[install] Zero-Touch Installer starting...",
      "[brew] Verifying tools: uv, bun, sox, ffmpeg, ripgrep, whisper-cpp...",
      "[bun] Installing Developer Harness dependencies in src/tools...",
      "[models] Downloading Vosk wake model (alphacephei.com)... 100%",
      "[models] Downloading whisper.cpp ggml-base.bin... 100%",
      "[env] Generating default .env with safe mode defaults",
      "[verify] Running self-test suite: 195/195 passed",
      "[install] Installation complete in 28.4s. Run ./boot.py to start."
    ]
  },
  {
    id: "calibrate",
    command: "./calibrate.py --save",
    title: "AX Auto-Calibration",
    badge: "WhatsApp UI",
    output: [
      "[calibrate] Connecting to WhatsApp Desktop Accessibility tree...",
      "✓ Detected Chat Header node: AXGroup > AXStaticText",
      "✓ Detected Message List container: AXScrollArea",
      "✓ Detected Voice Note player controls and attachment picker",
      "✓ Verified recipient: +16508702892 (Instinct Assistant)",
      "[save] Created backup of .env to .env.bak",
      "[save] Saved calibrated selectors and labels into .env successfully."
    ]
  },
  {
    id: "test",
    command: "./test.py",
    title: "Test Suite",
    badge: "195 Passing",
    output: [
      "============================= test session starts ==============================",
      "platform darwin -- Python 3.12.2, pytest-8.3.2, pluggy-1.5.0",
      "rootdir: /Users/hamdan/OpenAgent",
      "collected 195 items",
      "",
      "tests/test_boot.py ...........                                          [  5%]",
      "tests/test_dispatcher.py ................................               [ 22%]",
      "tests/test_harness_ipc.py .................                             [ 31%]",
      "tests/test_mac_ax.py .........................                          [ 44%]",
      "tests/test_browser_cdp.py ....................................           [ 62%]",
      "tests/test_social_locoagent.py ..............................           [ 78%]",
      "tests/test_security_guards.py ........................................   [100%]",
      "",
      "======================== 195 passed in 3.82s ========================="
    ]
  }
];

export function TerminalPreview() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText(activeTab.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper overflow-hidden">
      {/* Top Bar with Tabs */}
      <div className="bg-[#f5f3f1] border-b border-[#ebe8e4] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Terminal Window Dots */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ebe8e4] border border-[#a59f97]/40" />
          <div className="w-3 h-3 rounded-full bg-[#ebe8e4] border border-[#a59f97]/40" />
          <div className="w-3 h-3 rounded-full bg-[#ebe8e4] border border-[#a59f97]/40" />
          <span className="ml-2 text-[12px] font-mono text-[#777169] hidden sm:inline">
            terminal — zsh — 80x24
          </span>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all ${
                activeTab.id === tab.id
                  ? "bg-black text-white"
                  : "bg-[#fdfcfc] text-[#44403b] hover:bg-[#ebe8e4] border border-[#ebe8e4]"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Command Bar with Copy Button */}
      <div className="px-6 py-3.5 bg-[#fdfcfc] border-b border-[#ebe8e4] flex items-center justify-between gap-4 font-mono text-[13px]">
        <div className="flex items-center gap-2 text-black overflow-x-auto">
          <span className="text-[#a59f97] select-none">$</span>
          <span className="font-semibold text-black">{activeTab.command}</span>
        </div>
        <button
          type="button"
          onClick={copyCommand}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium text-[#44403b] bg-[#f5f3f1] hover:bg-[#ebe8e4] border border-[#ebe8e4] transition-colors shrink-0"
          aria-label="Copy command line"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#777169]" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Terminal Output */}
      <div className="p-6 bg-[#fdfcfc] font-mono text-[12px] md:text-[13px] leading-relaxed text-[#44403b] space-y-1.5 max-h-[320px] overflow-y-auto">
        {activeTab.output.map((line, idx) => (
          <div
            key={idx}
            className={`${
              line.startsWith("✓")
                ? "text-emerald-700"
                : line.startsWith("=")
                ? "text-[#777169]"
                : line.includes("[ready]") || line.includes("195 passed")
                ? "text-black font-semibold"
                : "text-[#44403b]"
            }`}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
