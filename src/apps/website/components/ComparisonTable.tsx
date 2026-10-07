import React from "react";
import { Check, Minus } from "lucide-react";

interface ComparisonItem {
  capability: string;
  instinct: boolean;
  withOpenAgent: boolean;
  note?: string;
}

const COMPARISON_DATA: ComparisonItem[] = [
  {
    capability: "Always-listening, hands-free voice sessions at your desk",
    instinct: false,
    withOpenAgent: true,
    note: "Offline Vosk wake word + continuous turn-taking"
  },
  {
    capability: "Account-level tasks (email, calendar, GitHub, Notion)",
    instinct: true,
    withOpenAgent: true,
    note: "Native Instinct cloud integrations"
  },
  {
    capability: "Proactive reminders and autonomous follow-ups",
    instinct: true,
    withOpenAgent: true,
    note: "Reaches out proactively via iMessage/WhatsApp"
  },
  {
    capability: "Shell execution and code edits on your local machine",
    instinct: false,
    withOpenAgent: true,
    note: "Sandboxed bash in zsh + atomic diff search/replace"
  },
  {
    capability: "Seeing your screen and controlling native macOS apps",
    instinct: false,
    withOpenAgent: true,
    note: "Quartz window screenshots + non-stealing PID clicks"
  },
  {
    capability: "Driving your authenticated, everyday Chrome profile",
    instinct: false,
    withOpenAgent: true,
    note: "Real Chrome CDP with cookies and session logins"
  },
  {
    capability: "Operating WhatsApp Desktop via Accessibility (AX)",
    instinct: false,
    withOpenAgent: true,
    note: "Auto-calibrated native macOS Accessibility tree"
  },
  {
    capability: "Posting & engaging on Threads & Reddit from your browser",
    instinct: false,
    withOpenAgent: true,
    note: "LocoAgent engine with anti-duplication ledger"
  },
  {
    capability: "Private, self-hosted web scraping and crawling",
    instinct: false,
    withOpenAgent: true,
    note: "Dockerized local Firecrawl without cloud API leaks"
  }
];

export function ComparisonTable() {
  return (
    <div className="w-full rounded-[20px] bg-[#fdfcfc] border border-[#ebe8e4] shadow-whisper overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#ebe8e4] bg-[#f5f3f1] text-[13px] font-medium text-[#44403b]">
              <th className="py-4 px-6 font-medium">Capability</th>
              <th className="py-4 px-6 text-center w-[160px] font-medium text-[#777169]">
                Instinct Alone
              </th>
              <th className="py-4 px-6 text-center w-[200px] font-semibold text-black bg-[#ebe8e4]/50">
                Instinct + OpenAgent ⌘
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ebe8e4] text-[14px]">
            {COMPARISON_DATA.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-[#f5f3f1]/50 transition-colors"
              >
                <td className="py-4 px-6">
                  <div className="font-normal text-black">{row.capability}</div>
                  {row.note && (
                    <div className="text-[12px] text-[#777169] mt-0.5 font-mono">
                      {row.note}
                    </div>
                  )}
                </td>

                <td className="py-4 px-6 text-center">
                  {row.instinct ? (
                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f5f3f1] text-[#44403b]">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[#a59f97]">
                      <Minus className="w-4 h-4" />
                    </div>
                  )}
                </td>

                <td className="py-4 px-6 text-center bg-[#ebe8e4]/20">
                  <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black text-white">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-[#f5f3f1] border-t border-[#ebe8e4] flex items-center justify-center text-[13px] font-medium text-[#44403b]">
        <span>Instinct thinks in the cloud. OpenAgent acts on your Mac.</span>
      </div>
    </div>
  );
}
