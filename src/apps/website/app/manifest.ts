import type { MetadataRoute } from "next";
import { productSummary, siteName, tagline } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteName} — ${tagline}`,
    short_name: siteName,
    description: productSummary,
    start_url: "/",
    scope: "/",
    display: "minimal-ui",
    background_color: "#fdfcfc",
    theme_color: "#fdfcfc",
    categories: ["developer", "productivity", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
