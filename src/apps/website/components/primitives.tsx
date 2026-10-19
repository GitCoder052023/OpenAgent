import type { ReactNode } from "react";
import { statusCopy, type Status } from "@/lib/content";

/**
 * A section label: a short rule followed by a mono caption. Used once per
 * section so a reader scanning the page can tell where they are without
 * every block needing a heading.
 */
export function SectionLabel({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <p
      className={`flex items-center gap-3 font-mono text-caption uppercase ${
        tone === "dark" ? "text-night-dim" : "text-smoke"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-px w-8 ${tone === "dark" ? "bg-night-line" : "bg-stone"}`}
      />
      {children}
    </p>
  );
}

/**
 * Product state, visible. The site distinguishes what runs today from what is
 * being trialled and what is direction, so the reader never has to guess.
 */
export function StatusTag({
  status,
  tone = "light",
}: {
  status: Status;
  tone?: "light" | "dark";
}) {
  const dot =
    status === "shipping"
      ? "bg-ink"
      : status === "experimental"
        ? "bg-spark"
        : "bg-ash";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-caption uppercase ${
        tone === "dark" ? "text-night-dim" : "text-smoke"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          tone === "dark" && status === "shipping" ? "bg-night-text" : dot
        }`}
      />
      {statusCopy[status]}
    </span>
  );
}

/** Hairline divider — DESIGN.md prefers these over shadows for separation. */
export function Hairline({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`h-px bg-stone ${className}`} />;
}

/** The one button shape in the system: a filled ink pill. */
export function PillLink({
  href,
  children,
  variant = "filled",
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "filled" | "outline" | "night";
  external?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition-colors duration-200";
  const variants = {
    filled: "bg-ink text-eggshell hover:bg-graphite",
    outline:
      "border border-stone bg-eggshell text-ink hover:border-graphite hover:bg-taupe",
    night:
      "border border-night-line bg-transparent text-night-text hover:border-night-dim hover:text-eggshell",
  } as const;

  return (
    <a
      href={href}
      className={`${base} ${variants[variant]} ${className}`}
      {...(external
        ? { target: "_blank", rel: "noreferrer noopener" }
        : undefined)}
    >
      {children}
    </a>
  );
}

/** Mono technical micro-copy. DESIGN.md: used sparingly, 13px, single weight. */
export function Mono({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono text-code ${className}`}>{children}</span>
  );
}
