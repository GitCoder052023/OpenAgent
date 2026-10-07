import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ToolsClient } from "./ToolsClient";
import { JsonLd } from "@/components/JsonLd";
import { TOOLS_DATA } from "@/lib/toolsData";

export const metadata: Metadata = {
  title: "55+ Local Tools Reference Catalog",
  description:
    "Complete searchable reference directory of all 55+ OpenAgent tools across Developer Harness, macOS Accessibility, Chrome CDP, Firecrawl, and LocoAgent.",
  alternates: {
    canonical: "https://openagent.sh/tools",
  },
  openGraph: {
    title: "55+ Local Tools Catalog | OpenAgent",
    description:
      "Explore 55+ native tools giving Instinct full control over terminal, files, real Chrome, screen, and social accounts on macOS.",
    url: "https://openagent.sh/tools",
  },
};

export default function ToolsPage() {
  const toolsSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "OpenAgent Local Tools Catalog",
    "description": "Catalog of 55+ local macOS tools provided by OpenAgent for Instinct.",
    "numberOfItems": TOOLS_DATA.length,
    "itemListElement": TOOLS_DATA.map((tool, index) => ({
      "@type": "SoftwareApplication",
      "position": index + 1,
      "name": tool.name,
      "description": tool.description,
      "applicationCategory": "DeveloperApplication",
    })),
  };

  return (
    <div className="py-16 md:py-24 px-6">
      <JsonLd data={toolsSchema} />

      <div className="max-w-[1280px] mx-auto space-y-12">
        {/* Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#777169] hover:text-black transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Overview</span>
          </Link>
        </div>

        {/* Page Header */}
        <div className="space-y-4 max-w-[800px]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[12px] text-[#44403b] font-mono">
            TOOL SUITE REFERENCE · 55+ LOCAL CAPABILITIES
          </div>
          <h1 className="text-[40px] md:text-[50px] font-display text-black">
            Local Tools Catalog
          </h1>
          <p className="text-[17px] leading-relaxed text-[#777169]">
            Instinct invokes these tools locally via structured envelopes. Search, filter by engine, and inspect arguments, schemas, and payload samples.
          </p>
        </div>

        {/* Client Search and Filter Grid */}
        <ToolsClient />
      </div>
    </div>
  );
}
