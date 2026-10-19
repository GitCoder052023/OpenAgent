import { renderOgImage, ogContentType, ogSize } from "@/lib/og";

export const alt = "OpenAgent privacy and security model";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "Privacy & security",
    lines: ["Where your data", "actually goes."],
    summary:
      "What stays on your Mac, what crosses the wire and when, and the six fail-closed safeguards around local execution.",
    footer: "local execution · fail-closed · execution ledger",
  });
}
