"use client";

import React, { useState, useMemo } from "react";
import { Search, Copy, Check, Terminal, Globe, Monitor, Database, Share2 } from "lucide-react";
import { TOOLS_DATA, ToolDefinition } from "@/lib/toolsData";

export function ToolsClient() {
  const [search, setSearch] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<string>("All");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const engines = [
    "All",
    "Developer Harness",
    "Native Computer Use",
    "Browser Harness CDP",
    "Web Ingestion (Firecrawl)",
    "Social Media (LocoAgent)",
  ];

  const filteredTools = useMemo(() => {
    return TOOLS_DATA.filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()) ||
        tool.keyArguments.toLowerCase().includes(search.toLowerCase());
      const matchesEngine =
        selectedEngine === "All" || tool.engine === selectedEngine;
      return matchesSearch && matchesEngine;
    });
  }, [search, selectedEngine]);

  const copyCall = (callText: string, index: number) => {
    navigator.clipboard.writeText(callText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getEngineBadge = (engine: ToolDefinition["engine"]) => {
    switch (engine) {
      case "Developer Harness":
        return { label: "Dev Harness", bg: "bg-[#f5f3f1]", icon: Terminal };
      case "Native Computer Use":
        return { label: "macOS AX", bg: "bg-[#f5f3f1]", icon: Monitor };
      case "Browser Harness CDP":
        return { label: "Chrome CDP", bg: "bg-[#f5f3f1]", icon: Globe };
      case "Web Ingestion (Firecrawl)":
        return { label: "Firecrawl", bg: "bg-[#f5f3f1]", icon: Database };
      case "Social Media (LocoAgent)":
        return { label: "LocoAgent", bg: "bg-[#f5f3f1]", icon: Share2 };
    }
  };

  return (
    <div className="space-y-8">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-[460px]">
          <Search className="w-4 h-4 text-[#777169] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools by name, arguments, or keywords..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[14px] text-black placeholder-[#a59f97] focus:outline-none focus:border-black transition-colors"
          />
        </div>

        {/* Results Counter */}
        <div className="text-[13px] text-[#777169] font-mono shrink-0">
          Showing {filteredTools.length} of {TOOLS_DATA.length} local tools
        </div>
      </div>

      {/* Engine Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {engines.map((eng) => (
          <button
            key={eng}
            type="button"
            onClick={() => setSelectedEngine(eng)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all shrink-0 ${
              selectedEngine === eng
                ? "bg-black text-white"
                : "bg-[#f5f3f1] text-[#44403b] hover:bg-[#ebe8e4] border border-[#ebe8e4]"
            }`}
          >
            {eng}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTools.map((tool, idx) => {
          const badge = getEngineBadge(tool.engine);
          const Icon = badge.icon;
          const isCopied = copiedIndex === idx;

          return (
            <div
              key={tool.name}
              className="p-6 rounded-[20px] bg-[#f5f3f1] border border-transparent hover:border-[#ebe8e4] transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[16px] font-bold text-black">
                      {tool.name}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-[#44403b] bg-[#fdfcfc] border border-[#ebe8e4]">
                    <Icon className="w-3 h-3 text-[#777169]" />
                    <span>{badge.label}</span>
                  </span>
                </div>

                <p className="text-[14px] leading-relaxed text-[#777169]">
                  {tool.description}
                </p>

                <div className="space-y-1 pt-1 font-mono text-[12px]">
                  <div className="text-[#a59f97] text-[11px]">ARGUMENTS:</div>
                  <div className="text-[#44403b] bg-[#fdfcfc] p-2 rounded-[8px] border border-[#ebe8e4]">
                    {tool.keyArguments}
                  </div>
                </div>
              </div>

              {tool.exampleCall && (
                <div className="pt-2 border-t border-[#ebe8e4] flex items-center justify-between gap-3 text-[12px] font-mono">
                  <span className="text-[#777169] truncate">
                    {tool.exampleCall}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyCall(tool.exampleCall!, idx)}
                    className="p-1.5 rounded-full hover:bg-[#ebe8e4] text-[#44403b] transition-colors shrink-0"
                    title="Copy payload JSON"
                    aria-label={`Copy JSON for ${tool.name}`}
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="p-12 text-center rounded-[20px] bg-[#f5f3f1] space-y-3">
          <p className="text-[16px] text-[#44403b] font-medium">
            No tools matched your query &ldquo;{search}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedEngine("All");
            }}
            className="text-[13px] text-black underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
