import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full bg-[#fdfcfc] border-t border-[#ebe8e4] pt-16 pb-12">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#ebe8e4]">
          {/* Col 1: Wordmark & Mission */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2 text-black font-semibold text-[17px] tracking-tight">
              <span>OpenAgent</span>
              <span className="text-[13px] font-mono px-1.5 py-0.5 rounded-[4px] bg-[#f5f3f1] text-[#44403b] border border-[#ebe8e4]">
                ⌘
              </span>
            </div>
            <p className="text-[14px] leading-relaxed text-[#777169]">
              The local macOS body for Instinct. Always-listening, hands-free personal assistant operating your native Mac, browser, and social channels.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[12px] text-[#44403b]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>195 Tests Passing · Active Beta</span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Product
            </h4>
            <ul className="space-y-2 text-[14px]">
              <li>
                <Link href="/" className="text-[#44403b] hover:text-black transition-colors">
                  Overview
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="text-[#44403b] hover:text-black transition-colors">
                  Architecture & Transport
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-[#44403b] hover:text-black transition-colors">
                  55+ Local Tools Catalog
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-[#44403b] hover:text-black transition-colors">
                  Quick Start & CLI
                </Link>
              </li>
              <li>
                <Link href="/security" className="text-[#44403b] hover:text-black transition-colors">
                  Security & Threat Model
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Technical Primitives */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Core Engines
            </h4>
            <ul className="space-y-2 text-[14px] text-[#44403b]">
              <li>Developer Harness (Bun + zsh)</li>
              <li>Voice Interface (Vosk + Whisper)</li>
              <li>Native macOS Computer Use (AX)</li>
              <li>Real Browser Control (CDP)</li>
              <li>Web Ingestion (Firecrawl Docker)</li>
              <li>Social Automation (LocoAgent)</li>
            </ul>
          </div>

          {/* Col 4: Community & Open Source */}
          <div className="space-y-3">
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-[#a59f97]">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-[14px]">
              <li>
                <a
                  href="https://github.com/GitCoder052023/OpenAgent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#44403b] hover:text-black transition-colors"
                >
                  GitHub Repository
                  <ArrowUpRight className="w-3 h-3 text-[#777169]" />
                </a>
              </li>
              <li>
                <a
                  href="https://instinct.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#44403b] hover:text-black transition-colors"
                >
                  Instinct AI
                  <ArrowUpRight className="w-3 h-3 text-[#777169]" />
                </a>
              </li>
              <li>
                <a
                  href="https://browser-use.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#44403b] hover:text-black transition-colors"
                >
                  Browser Use
                  <ArrowUpRight className="w-3 h-3 text-[#777169]" />
                </a>
              </li>
              <li>
                <a
                  href="https://firecrawl.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#44403b] hover:text-black transition-colors"
                >
                  Firecrawl
                  <ArrowUpRight className="w-3 h-3 text-[#777169]" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-[#777169]">
          <p>
            OpenAgent is open-source software licensed under the{" "}
            <a
              href="https://github.com/GitCoder052023/OpenAgent/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black underline underline-offset-2 hover:opacity-80"
            >
              MIT License
            </a>
            .
          </p>
          <div className="flex items-center gap-6">
            <span>macOS 14 (Sonoma) & macOS 15 (Sequoia)</span>
            <span>·</span>
            <span>Apple Silicon & Intel</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
