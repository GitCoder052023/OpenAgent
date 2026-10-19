import { Hero } from "@/components/hero";
import { TheGap } from "@/components/the-gap";
import { TransportDemo } from "@/components/transport-demo";
import { Architecture } from "@/components/architecture";
import { Engines } from "@/components/engines";
import { GhostMode } from "@/components/ghost-mode";
import { Voice } from "@/components/voice";
import { QuickStart } from "@/components/quick-start";
import { Vision } from "@/components/vision";
import { HomeQuestions } from "@/components/home-questions";
import { toolCount } from "@/lib/tools";
import { pageMetadata, tagline } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "OpenAgent — open-source local AI agent for macOS",
  absoluteTitle: true,
  ogTitle: `OpenAgent — ${tagline}`,
  description: `OpenAgent is an open-source, MIT-licensed macOS execution environment. ${toolCount} local tools let an AI assistant drive your shell, Chrome, native apps and WhatsApp — hands-free, on your own Mac.`,
  imageAlt: "OpenAgent — Instinct thinks. OpenAgent acts.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <Hero />
      <TheGap />
      <TransportDemo />
      <Architecture />
      <GhostMode />
      <Voice />
      <Engines />
      <QuickStart />
      <Vision />
      <HomeQuestions />
    </>
  );
}
