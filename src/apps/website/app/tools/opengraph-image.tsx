import { renderOgImage, ogContentType, ogSize } from "@/lib/og";
import { toolCount } from "@/lib/tools";

export const alt = `OpenAgent tool reference — all ${toolCount} tools across nine engines`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "Reference",
    lines: [`${toolCount} tools.`, "Nine engines."],
    summary:
      "Everything a connected AI assistant can call on your Mac, with the arguments each tool takes.",
    footer: "bash · mac_see · browser_open · firecrawl_scrape · whatsapp_send",
  });
}
