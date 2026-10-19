import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everything here is public documentation for an open-source project,
      // including for the crawlers that feed AI assistants.
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
