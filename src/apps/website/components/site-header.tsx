"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { repoUrl } from "@/lib/content";

const nav = [
  { label: "Watch a request", href: "/#transport" },
  { label: "Engines", href: "/#engines" },
  { label: "Architecture", href: "/#architecture" },
  { label: "Tools", href: "/tools" },
  { label: "Vision", href: "/#vision" },
];

export function SiteHeader() {
  const [lifted, setLifted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        lifted || open
          ? "border-b border-stone bg-eggshell/85 backdrop-blur-sm"
          : "border-b border-transparent"
      }`}
    >
      <div className="gutter flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-baseline gap-1.5 text-body font-medium tracking-tight text-ink"
        >
          OpenAgent
          <span aria-hidden="true" className="text-body-sm text-ash">
            ⌘
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 lg:flex"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body-sm text-graphite transition-colors duration-200 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite"
          >
            GitHub
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex size-9 items-center justify-center rounded-full border border-stone text-ink lg:hidden"
          >
            <span className="sr-only">
              {open ? "Close menu" : "Open menu"}
            </span>
            <svg
              aria-hidden="true"
              width="14"
              height="10"
              viewBox="0 0 14 10"
              fill="none"
            >
              <path
                d={open ? "M1 1L13 9M13 1L1 9" : "M0 1h14M0 9h14"}
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="gutter border-t border-stone pb-6 pt-4 lg:hidden"
      >
        <ul className="flex flex-col">
          {nav.map((item) => (
            <li key={item.href} className="border-b border-stone last:border-0">
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block py-3 text-subheading font-light text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
