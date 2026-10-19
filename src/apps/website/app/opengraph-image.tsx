import { renderOgImage, ogContentType, ogSize } from "@/lib/og";
import { toolCount } from "@/lib/tools";

export const alt = "OpenAgent — Instinct thinks. OpenAgent acts.";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "macOS · MIT · active beta",
    lines: ["Instinct thinks.", "OpenAgent acts."],
    summary: `An open-source macOS execution environment. ${toolCount} callable tools, running on your own hardware.`,
    footer: "shell · native apps · chrome · social · whatsapp · mcp",
  });
}
