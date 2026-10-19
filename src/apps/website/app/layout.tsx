import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteUrl } from "@/lib/content";
import {
  JsonLd,
  personJsonLd,
  productSummary,
  siteName,
  softwareApplicationJsonLd,
  softwareSourceCodeJsonLd,
  tagline,
  websiteJsonLd,
} from "@/lib/seo";

/**
 * DESIGN.md calls for Waldenburg at weight 300 for display type with Inter
 * underneath; Inter Light is the documented substitute, so one family covers
 * both roles. Geist Mono carries technical micro-copy only. Both are
 * self-hosted by next/font at build time — no runtime request leaves the page.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${tagline}`,
    template: `%s — ${siteName}`,
  },
  description: productSummary,
  applicationName: siteName,
  keywords: [
    "OpenAgent",
    "open source AI agent",
    "macOS AI agent",
    "local AI assistant",
    "computer use agent",
    "desktop automation",
    "voice controlled assistant",
    "Jarvis",
    "self-hosted AI",
    "privacy-focused AI assistant",
    "Model Context Protocol",
    "MCP client",
    "Whisper Large V3 Turbo",
    "browser automation",
    "Chrome DevTools Protocol",
    "OpenInstinct",
    "Instinct AI",
  ],
  authors: [{ name: "Hamdan Khubaib", url: "https://github.com/GitCoder052023" }],
  creator: "Hamdan Khubaib",
  publisher: "OpenAgent",
  openGraph: {
    type: "website",
    siteName,
    url: "/",
    title: `${siteName} — ${tagline}`,
    description: productSummary,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — ${tagline}`,
    description: productSummary,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#fdfcfc",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-eggshell text-ink">
        {/* Site-wide entities. Page-specific nodes (FAQPage, BreadcrumbList)
            are emitted by the pages themselves and join this graph by @id. */}
        <JsonLd
          graph={[
            websiteJsonLd(),
            softwareApplicationJsonLd(),
            softwareSourceCodeJsonLd(),
            personJsonLd(),
          ]}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-body-sm focus:text-eggshell"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
