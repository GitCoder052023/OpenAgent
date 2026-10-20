"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { repoUrl } from "@/lib/content";

const nav = [
  { label: "How it works", href: "/#architecture" },
  { label: "Engines", href: "/#engines" },
  { label: "Tools", href: "/tools" },
  { label: "Privacy", href: "/privacy" },
  { label: "FAQ", href: "/faq" },
  { label: "Vision", href: "/#vision" },
];

export function SiteHeader() {
  const [lifted, setLifted] = useState(false);
  const pathname = usePathname();
  // The menu records which route it was opened on, so a navigation closes it
  // by derivation rather than by a setState inside an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = useCallback(
    (next: boolean) => setOpenedOn(next ? pathname : null),
    [pathname],
  );
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(
    (returnFocus = false) => {
      setOpenedOn(null);
      if (returnFocus) toggleRef.current?.focus();
    },
    [],
  );

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Growing past the breakpoint where the full navigation reappears also
  // closes the panel, so it can never be left orphaned off screen.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpenedOn(null);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key !== "Tab") return;
      // Keep Tab inside the open panel and its toggle.
      const focusable = [
        toggleRef.current,
        ...(panelRef.current?.querySelectorAll<HTMLElement>("a[href], button") ??
          []),
      ].filter(Boolean) as HTMLElement[];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setOpenedOn(null);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    // Stop the page scrolling behind the panel without shifting the layout.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300 ${
        lifted || open
          ? "border-b border-stone bg-eggshell/90 backdrop-blur-sm"
          : "border-b border-transparent"
      }`}
    >
      <div className="gutter flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="-mx-2 flex min-h-11 items-center gap-1.5 px-2 text-body font-medium tracking-tight text-ink"
        >
          OpenAgent
          <span aria-hidden="true" className="text-body-sm text-ash">
            ⌘
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-5 lg:flex xl:gap-7"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center text-body-sm text-graphite transition-colors duration-200 hover:text-ink pointer-fine:min-h-0 pointer-fine:py-2"
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
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-body-sm font-medium text-eggshell transition-colors duration-200 hover:bg-graphite pointer-fine:min-h-9"
          >
            GitHub
          </a>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full border border-stone text-ink lg:hidden"
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
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
        ref={panelRef}
        hidden={!open}
        className="max-h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain border-t border-stone bg-eggshell/95 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden"
      >
        <ul className="gutter flex flex-col">
          {nav.map((item) => (
            <li key={item.href} className="border-b border-stone last:border-0">
              <Link
                href={item.href}
                onClick={() => close()}
                className="flex min-h-14 items-center text-subheading font-light text-ink"
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
