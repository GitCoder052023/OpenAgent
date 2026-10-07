"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight } from "lucide-react";

function GithubIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: "Overview", href: "/" },
    { label: "Architecture", href: "/architecture" },
    { label: "55+ Tools", href: "/tools" },
    { label: "Documentation", href: "/docs" },
    { label: "Security", href: "/security" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#fdfcfc]/90 backdrop-blur-md border-b border-[#ebe8e4]">
      <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-black font-semibold text-[17px] tracking-tight hover:opacity-80 transition-opacity"
            aria-label="OpenAgent Home"
          >
            <span>OpenAgent</span>
            <span className="text-[13px] font-mono px-1.5 py-0.5 rounded-[4px] bg-[#f5f3f1] text-[#44403b] border border-[#ebe8e4]">
              ⌘
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[14px] transition-colors ${
                    isActive
                      ? "text-black font-medium"
                      : "text-[#777169] hover:text-black"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com/GitCoder052023/OpenAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-[#44403b] bg-[#fdfcfc] hover:bg-[#f5f3f1] border border-[#ebe8e4] transition-all"
            aria-label="GitHub Repository"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
            <ArrowUpRight className="w-3 h-3 text-[#777169]" />
          </a>

          <Link
            href="/docs"
            className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[13px] font-medium text-white bg-black hover:bg-[#222222] transition-colors border border-black shadow-sm"
          >
            Quick Start
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-1.5 text-[#44403b] hover:text-black rounded-lg focus:outline-none"
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden border-b border-[#ebe8e4] bg-[#fdfcfc] px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block text-[15px] py-1.5 text-[#44403b] hover:text-black font-medium"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-[#ebe8e4] flex flex-col gap-2.5">
            <a
              href="https://github.com/GitCoder052023/OpenAgent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 rounded-full text-[14px] font-medium text-[#44403b] bg-[#f5f3f1] border border-[#ebe8e4]"
            >
              <GithubIcon className="w-4 h-4" />
              <span>GitHub Repository</span>
            </a>
            <Link
              href="/docs"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center py-2 rounded-full text-[14px] font-medium text-white bg-black text-center"
            >
              Quick Start
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
