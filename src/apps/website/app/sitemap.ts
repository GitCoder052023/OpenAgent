import type { MetadataRoute } from "next";
import { absolute, routes } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: absolute(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
