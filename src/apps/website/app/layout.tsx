import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { repoUrl, siteUrl } from "@/lib/content";
import { toolCount } from "@/lib/tools";

/**
 * DESIGN.md calls for Waldenburg at weight 300 for display type with Inter
 * underneath; Inter Light is the documented substitute, so one family covers
 * both roles. Geist Mono carries technical micro-copy only.
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

const description = `OpenAgent is an open-source, local macOS execution environment with ${toolCount} callable tools. It gives a cloud assistant hands-free voice control of your Mac: shell and code edits, native app control, your authenticated Chrome, social automation and WhatsApp — all running on your own hardware.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OpenAgent — Instinct thinks. OpenAgent acts.",
    template: "%s — OpenAgent",
  },
  description,
  applicationName: "OpenAgent",
  keywords: [
    "OpenAgent",
    "macOS AI agent",
    "local AI assistant",
    "computer use",
    "Jarvis",
    "Instinct AI",
    "open source",
    "self-hosted",
    "Model Context Protocol",
    "Whisper",
    "browser automation",
  ],
  authors: [{ name: "OpenAgent contributors", url: repoUrl }],
  creator: "OpenAgent contributors",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "OpenAgent",
    url: "/",
    title: "OpenAgent — Instinct thinks. OpenAgent acts.",
    description,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenAgent — Instinct thinks. OpenAgent acts.",
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#fdfcfc",
  colorScheme: "light",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "OpenAgent",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS 14+",
  license: "https://opensource.org/licenses/MIT",
  url: siteUrl,
  codeRepository: repoUrl,
  description,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-eggshell text-ink">
        <script
          type="application/ld+json"
          // Static, author-controlled structured data.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
