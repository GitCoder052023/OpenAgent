import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#fdfcfc",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://openagent.sh"),
  title: {
    default: "OpenAgent ⌘ — The Local macOS Body for Instinct",
    template: "%s | OpenAgent",
  },
  description:
    "Say 'Wake up, Jarvis.' Then just talk. OpenAgent is the local macOS body for Instinct. Always-listening, hands-free AI assistant operating your Mac, authenticated Chrome, self-hosted Firecrawl, and social media accounts.",
  keywords: [
    "OpenAgent",
    "Instinct",
    "macOS AI assistant",
    "Jarvis AI",
    "hands-free voice assistant",
    "macOS automation",
    "Chrome CDP agent",
    "computer use agent",
    "offline wake word",
    "Vosk",
    "whisper.cpp",
    "Firecrawl",
    "LocoAgent",
    "WhatsApp desktop bridge",
    "autonomous desktop AI"
  ],
  authors: [{ name: "OpenAgent Contributors", url: "https://github.com/GitCoder052023/OpenAgent" }],
  creator: "OpenAgent Project",
  publisher: "OpenAgent",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://openagent.sh",
    siteName: "OpenAgent",
    title: "OpenAgent ⌘ — The Local macOS Body for Instinct",
    description:
      "Say 'Wake up, Jarvis.' Then just talk. OpenAgent gives Instinct a voice interface and executes shell commands, code diffs, native apps, and browser tasks locally on your Mac.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OpenAgent — The Local macOS Body for Instinct",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenAgent ⌘ — The Local macOS Body for Instinct",
    description:
      "Say 'Wake up, Jarvis.' Then just talk. Local macOS assistant operating your Mac, browser, and social channels with offline wake word and 55+ tools.",
    creator: "@hamdankhubaib",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "https://openagent.sh",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const globalSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "OpenAgent",
        "operatingSystem": "macOS 14 (Sonoma), macOS 15 (Sequoia)",
        "applicationCategory": "DeveloperApplication",
        "description":
          "The local macOS body for Instinct. Always-listening, hands-free assistant operating your Mac, browser, and social media accounts.",
        "softwareRequirements": "macOS, Python 3.11+, uv, Bun, WhatsApp Desktop",
        "downloadUrl": "https://github.com/GitCoder052023/OpenAgent",
        "license": "https://opensource.org/licenses/MIT",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "WebSite",
        "name": "OpenAgent",
        "url": "https://openagent.sh",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://openagent.sh/tools?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };

  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full scroll-smooth`}>
      <head>
        <JsonLd data={globalSchema} />
      </head>
      <body className="min-h-full flex flex-col bg-[#fdfcfc] text-black font-sans selection:bg-black selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
