"use client";

import React, { useRef, useState } from "react";
import { Play, Volume2, Sparkles, CheckCircle2, ArrowUpRight } from "lucide-react";

export function VideoShowcase() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayToggle = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <section className="relative py-16 md:py-24 px-6 overflow-hidden bg-[#fdfcfc]">
      <div className="max-w-[1280px] mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-4 max-w-[680px]">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[13px] text-[#44403b]">
              <span className="w-2 h-2 rounded-full bg-[#0447ff]"></span>
              <span className="font-medium">Product Launch Film</span>
            </div>
            <h2 className="text-[32px] sm:text-[40px] md:text-[46px] font-display text-black leading-tight tracking-[-0.02em]">
              See OpenAgent operate your Mac in real time.
            </h2>
            <p className="text-[16px] md:text-[18px] text-[#777169] leading-relaxed">
              Watch how OpenAgent bridges cloud intelligence to your desktop: voice detection, local shell execution, 195 green tests, and an authenticated social update — all while making coffee.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[13px] text-[#777169]">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f3f1] border border-[#ebe8e4]">
              <Volume2 className="w-3.5 h-3.5 text-[#44403b]" />
              <span>Includes sound & voice</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f3f1] border border-[#ebe8e4]">
              <span className="font-mono text-xs text-[#44403b]">45s</span>
              <span>1080p</span>
            </div>
          </div>
        </div>

        {/* Video Player Card */}
        <div className="relative rounded-[24px] border border-[#ebe8e4] bg-[#111113] shadow-[0_24px_70px_rgba(20,20,24,0.12)] overflow-hidden">
          {/* Top macOS-style window chrome bar */}
          <div className="h-11 px-5 border-b border-[#232327] bg-[#18181c] flex items-center justify-between text-[13px] text-[#8a8a90]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57] opacity-80"></span>
              <span className="w-3 h-3 rounded-full bg-[#febc2e] opacity-80"></span>
              <span className="w-3 h-3 rounded-full bg-[#28c840] opacity-80"></span>
              <span className="ml-3 font-mono text-[12px] text-[#6d6d75]">OpenAgent ⌘ — Product Demo</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://next.frame.io/project/beb128d7-5d04-44cc-8c42-3d00efb3ae91/view/60ec5832-4c87-436a-ab83-06dd8de24f9a"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#25252b] hover:bg-[#32323a] text-[12px] text-white transition-colors"
              >
                <span>Frame.io</span>
                <ArrowUpRight className="w-3 h-3 text-[#a59f97]" />
              </a>
              <span className="flex items-center gap-1.5 text-[12px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Jarvis Active
              </span>
            </div>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video w-full bg-black group">
            <video
              ref={videoRef}
              src="https://next.frame.io/project/beb128d7-5d04-44cc-8c42-3d00efb3ae91/view/60ec5832-4c87-436a-ab83-06dd8de24f9a"
              poster="/assets/brag.jpg"
              controls
              playsInline
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
            >
              <source
                src="https://next.frame.io/project/beb128d7-5d04-44cc-8c42-3d00efb3ae91/view/60ec5832-4c87-436a-ab83-06dd8de24f9a"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>

            {/* Custom Overlay Play Button (visible when paused) */}
            {!isPlaying && (
              <a
                href="https://next.frame.io/project/beb128d7-5d04-44cc-8c42-3d00efb3ae91/view/60ec5832-4c87-436a-ab83-06dd8de24f9a"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px] cursor-pointer transition-opacity group-hover:bg-black/25"
              >
                <div className="flex flex-col items-center gap-3 transform transition-transform duration-200 group-hover:scale-105">
                  <div className="w-20 h-20 rounded-full bg-white/95 text-black flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.5)] pl-1 transition-all hover:bg-white hover:scale-110">
                    <Play className="w-8 h-8 fill-black" />
                  </div>
                  <span className="px-3.5 py-1.5 rounded-full bg-black/70 border border-white/20 text-white text-[13px] font-medium backdrop-blur-md flex items-center gap-1.5">
                    <span>Watch on Frame.io (0:45)</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-white/80" />
                  </span>
                </div>
              </a>
            )}
          </div>

          {/* Video Highlights Footer Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#232327] bg-[#141416] border-t border-[#232327]">
            <div className="p-5 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[#6C8CFF] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-[14px] font-medium text-white">Always-Listening Voice</h4>
                <p className="text-[13px] text-[#8a8a90] leading-snug">
                  Offline Vosk wake word (&ldquo;Wake up, Jarvis&rdquo;) with Whisper speech intelligence.
                </p>
              </div>
            </div>

            <div className="p-5 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-[14px] font-medium text-white">55+ Tools Across 5 Engines</h4>
                <p className="text-[13px] text-[#8a8a90] leading-snug">
                  Developer Harness, macOS AX, Real Chrome CDP, Firecrawl &amp; Social Automation.
                </p>
              </div>
            </div>

            <div className="p-5 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-[14px] font-medium text-white">Zero API Keys</h4>
                <p className="text-[13px] text-[#8a8a90] leading-snug">
                  Instinct connects directly to WhatsApp Desktop with fail-closed security guards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
