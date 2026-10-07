"use client";

import React, { useState } from "react";
import { Check, ArrowRight, RefreshCw } from "lucide-react";

interface Turn {
  speaker: string;
  role: "user" | "jarvis" | "system" | "tool";
  text: string;
  meta?: string;
  toolDetails?: {
    name: string;
    target: string;
    result: string;
  };
}

const TURNS: Turn[] = [
  {
    speaker: "System",
    role: "system",
    text: "[ Jarvis sleeping · Vosk offline wake daemon listening ]"
  },
  {
    speaker: "You (making coffee)",
    role: "user",
    text: '"Wake up, Jarvis."'
  },
  {
    speaker: "Jarvis",
    role: "jarvis",
    text: "[ Audio chime · Jarvis awake and listening continuously ]"
  },
  {
    speaker: "You",
    role: "user",
    text: '"Run the test suite on OpenAgent. If it\'s green, post a Threads update about what I shipped today."'
  },
  {
    speaker: "Developer Harness",
    role: "tool",
    text: "Executing test suite...",
    toolDetails: {
      name: "bash",
      target: "./test.py",
      result: "195 passed in 3.8s"
    }
  },
  {
    speaker: "Developer Harness",
    role: "tool",
    text: "Inspecting today's commits...",
    toolDetails: {
      name: "bash",
      target: "git log --since=midnight --oneline",
      result: "6 commits authored"
    }
  },
  {
    speaker: "LocoAgent Ledger",
    role: "tool",
    text: "Verifying deduplication ledger...",
    toolDetails: {
      name: "social_dedup_check",
      target: "threads.net / post",
      result: "not yet posted today"
    }
  },
  {
    speaker: "LocoAgent Chrome CDP",
    role: "tool",
    text: "Publishing via authenticated Chrome profile...",
    toolDetails: {
      name: "social_post",
      target: "threads.net (@hamdankhubaib.code)",
      result: "Published successfully"
    }
  },
  {
    speaker: "Jarvis (Audio Out)",
    role: "jarvis",
    text: '"All 195 tests passed. The update is live on Threads."'
  },
  {
    speaker: "You (from the couch)",
    role: "user",
    text: '"Show me what it looks like."'
  },
  {
    speaker: "LocoAgent Chrome CDP",
    role: "tool",
    text: "Capturing viewport screenshot...",
    toolDetails: {
      name: "social_screenshot",
      target: "live Chrome window",
      result: "delivered as image attachment to WhatsApp"
    }
  },
  {
    speaker: "Jarvis (Audio Out)",
    role: "jarvis",
    text: '"Screenshot\'s in your chat."'
  },
  {
    speaker: "You",
    role: "user",
    text: '"Jarvis, stand by."'
  },
  {
    speaker: "Jarvis",
    role: "jarvis",
    text: '"Standing by." [ Jarvis sleeping ]'
  }
];

export function VoiceTurnSimulator() {
  const [visibleTurnsCount, setVisibleTurnsCount] = useState<number>(4);

  const handleNext = () => {
    if (visibleTurnsCount < TURNS.length) {
      setVisibleTurnsCount((prev) => prev + 1);
    }
  };

  const handleReset = () => {
    setVisibleTurnsCount(4);
  };

  const handleShowAll = () => {
    setVisibleTurnsCount(TURNS.length);
  };

  return (
    <div className="w-full rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-[#f5f3f1] border-b border-[#ebe8e4] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[13px] font-mono text-black font-semibold">
            CONTINUOUS_HANDS_FREE_CONVERSATION
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-full hover:bg-[#ebe8e4] text-[#777169] transition-colors"
            title="Reset simulation"
            aria-label="Reset simulation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dialogue Stream */}
      <div className="p-6 space-y-4 max-h-[460px] overflow-y-auto">
        {TURNS.slice(0, visibleTurnsCount).map((turn, idx) => {
          if (turn.role === "system") {
            return (
              <div
                key={idx}
                className="text-center font-mono text-[12px] text-[#777169] py-1 border-y border-[#ebe8e4]/60"
              >
                {turn.text}
              </div>
            );
          }

          if (turn.role === "tool" && turn.toolDetails) {
            return (
              <div
                key={idx}
                className="ml-6 sm:ml-10 p-3 rounded-[12px] bg-[#f5f3f1] border border-[#ebe8e4] font-mono text-[12px] flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-black text-white text-[11px] font-semibold">
                    {turn.toolDetails.name}
                  </span>
                  <span className="text-[#44403b]">{turn.toolDetails.target}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>{turn.toolDetails.result}</span>
                </div>
              </div>
            );
          }

          const isUser = turn.role === "user";
          return (
            <div
              key={idx}
              className={`flex flex-col ${isUser ? "items-start" : "items-end"}`}
            >
              <span className="text-[11px] font-medium text-[#a59f97] mb-1 px-1">
                {turn.speaker}
              </span>
              <div
                className={`max-w-[85%] rounded-[18px] px-4 py-2.5 text-[14px] leading-relaxed ${
                  isUser
                    ? "bg-[#ebe8e4]/60 text-black rounded-tl-sm"
                    : "bg-black text-white rounded-tr-sm"
                }`}
              >
                {turn.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controller Footer */}
      <div className="p-4 bg-[#f5f3f1] border-t border-[#ebe8e4] flex items-center justify-between gap-3 text-[13px]">
        <div className="text-[#777169] text-[12px] font-mono">
          Turn {visibleTurnsCount} of {TURNS.length}
        </div>
        <div className="flex items-center gap-2">
          {visibleTurnsCount < TURNS.length ? (
            <>
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black text-white font-medium hover:bg-[#222222] transition-colors"
              >
                <span>Advance Turn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleShowAll}
                className="px-3 py-1.5 rounded-full bg-[#fdfcfc] text-[#44403b] border border-[#ebe8e4] font-medium hover:bg-[#ebe8e4] transition-colors"
              >
                Show All
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-1.5 rounded-full bg-black text-white font-medium hover:bg-[#222222] transition-colors"
            >
              Restart Dialogue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
