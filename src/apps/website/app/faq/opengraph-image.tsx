import { renderOgImage, ogContentType, ogSize } from "@/lib/og";

export const alt = "OpenAgent FAQ — requirements, privacy, models and setup";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage({
    eyebrow: "Questions",
    lines: ["OpenAgent,", "answered."],
    summary:
      "What it runs on, what it can do today, what leaves your machine, and which parts are still experimental.",
    footer: "platforms · capabilities · models · privacy · licensing",
  });
}
