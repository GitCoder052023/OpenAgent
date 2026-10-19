import { Hero } from "@/components/hero";
import { TheGap } from "@/components/the-gap";
import { TransportDemo } from "@/components/transport-demo";
import { Architecture } from "@/components/architecture";
import { Engines } from "@/components/engines";
import { GhostMode } from "@/components/ghost-mode";
import { Voice } from "@/components/voice";
import { QuickStart } from "@/components/quick-start";
import { Vision } from "@/components/vision";

export default function Home() {
  return (
    <>
      <Hero />
      <TheGap />
      <TransportDemo />
      <Architecture />
      <Engines />
      <GhostMode />
      <Voice />
      <QuickStart />
      <Vision />
    </>
  );
}
