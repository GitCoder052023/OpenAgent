import type { Metadata } from "next";
import { repoUrl, siteUrl } from "@/lib/content";
import { toolCategories, toolCount } from "@/lib/tools";

export const siteName = "OpenAgent";
export const tagline = "Instinct thinks. OpenAgent acts.";

/**
 * The one-paragraph definition of the project. Every surface that has to
 * describe OpenAgent — meta description, structured data, llms.txt — derives
 * from this so a crawler, a person and an AI assistant all read the same claim.
 */
export const productSummary = `OpenAgent is an open-source, MIT-licensed execution environment for macOS. It runs on your own Mac and exposes ${toolCount} callable tools — shell and file editing, native app control through the macOS Accessibility API, your authenticated Chrome over CDP, self-hosted web scraping, social media automation, Office documents, WhatsApp and any external MCP server — to an AI assistant that reasons about what you asked. Wake-word detection and transcription run on-device on Whisper Large V3 Turbo, so you can drive it hands-free while you do something else.`;

export const author = {
  name: "Hamdan Khubaib",
  url: "https://github.com/GitCoder052023",
};

/** Routes the site owns, in the order they should be crawled and listed. */
export const routes = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/tools", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/faq", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.7, changeFrequency: "monthly" as const },
];

export function absolute(path: string) {
  return new URL(path, `${siteUrl}/`).toString().replace(/\/$/, "") || siteUrl;
}

/**
 * Shared page metadata.
 *
 * `openGraph` is shallowly merged and *replaced* by the deepest segment that
 * defines it, which drops the file-based opengraph-image the root layout
 * picked up. Every page therefore names its own share card explicitly; each
 * route has an opengraph-image.tsx sitting next to its page.tsx.
 */
export function pageMetadata({
  title,
  absoluteTitle,
  description,
  path,
  ogTitle,
  imageAlt,
}: {
  title: string;
  /** Skip the "… — OpenAgent" template, for pages that carry the brand already. */
  absoluteTitle?: boolean;
  description: string;
  path: string;
  ogTitle?: string;
  imageAlt: string;
}): Metadata {
  const image = {
    url: `${path === "/" ? "" : path}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: imageAlt,
    type: "image/png",
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName,
      url: path,
      title: ogTitle ?? title,
      description,
      locale: "en",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle ?? title,
      description,
      images: [image],
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Structured data                                                             */
/*                                                                             */
/* Only properties the repository can actually support. No ratings, no review  */
/* counts, no download numbers, no pricing beyond the fact that it is free.    */
/* -------------------------------------------------------------------------- */

const softwareId = `${siteUrl}/#software`;
const websiteId = `${siteUrl}/#website`;
const authorId = `${siteUrl}/#author`;

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    url: `${siteUrl}/`,
    name: siteName,
    alternateName: "OpenAgent for macOS",
    description: productSummary,
    inLanguage: "en",
    license: "https://opensource.org/licenses/MIT",
    author: { "@id": authorId },
    about: { "@id": softwareId },
  };
}

export function personJsonLd() {
  return {
    "@type": "Person",
    "@id": authorId,
    name: author.name,
    url: author.url,
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@type": "SoftwareApplication",
    "@id": softwareId,
    name: siteName,
    alternateName: "OpenAgent macOS agent",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "AI agent / desktop automation",
    operatingSystem: "macOS 14 Sonoma, macOS 15 Sequoia",
    processorRequirements: "Apple Silicon or Intel",
    softwareRequirements:
      "uv, Homebrew, Bun, WhatsApp Desktop, ~2 GB free disk space for the Whisper Large V3 Turbo weights",
    url: `${siteUrl}/`,
    description: productSummary,
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    installUrl: `${siteUrl}/#install`,
    downloadUrl: repoUrl,
    codeRepository: repoUrl,
    releaseNotes: `${repoUrl}/releases`,
    author: { "@id": authorId },
    maintainer: { "@id": authorId },
    sameAs: [repoUrl],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    featureList: toolCategories.map((c) => `${c.label} (${c.tools.length} tools)`),
  };
}

export function softwareSourceCodeJsonLd() {
  return {
    "@type": "SoftwareSourceCode",
    "@id": `${siteUrl}/#source`,
    name: siteName,
    description: productSummary,
    codeRepository: repoUrl,
    programmingLanguage: ["Python", "TypeScript", "Go"],
    runtimePlatform: "macOS",
    license: "https://opensource.org/licenses/MIT",
    author: { "@id": authorId },
    targetProduct: { "@id": softwareId },
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

export function faqJsonLd(
  entries: { question: string; answer: string }[],
  path: string,
) {
  return {
    "@type": "FAQPage",
    "@id": `${absolute(path)}#faq`,
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** Emits one `@graph` document so every node can cross-reference by @id. */
export function JsonLd({ graph }: { graph: object[] }) {
  return (
    <script
      type="application/ld+json"
      // Author-controlled, statically generated at build time.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
