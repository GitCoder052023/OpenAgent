import Link from "next/link";
import { credits, docLinks, repoUrl } from "@/lib/content";

const pages = [
  { label: "Overview", href: "/" },
  { label: "Tool reference", href: "/tools" },
  { label: "FAQ", href: "/faq" },
  { label: "Privacy & security", href: "/privacy" },
];

const project = [
  { label: "Contributing", href: `${repoUrl}/blob/main/CONTRIBUTING.md` },
  { label: "Code of conduct", href: `${repoUrl}/blob/main/CODE_OF_CONDUCT.md` },
  { label: "Security policy", href: `${repoUrl}/blob/main/SECURITY.md` },
  { label: "MIT licence", href: `${repoUrl}/blob/main/LICENSE` },
  { label: "Issues", href: `${repoUrl}/issues` },
];

function External({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-h-11 items-center text-body-sm text-graphite transition-colors duration-200 hover:text-ink pointer-fine:inline-block pointer-fine:min-h-0 pointer-fine:py-0.5"
    >
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-stone py-12 sm:py-16 lg:py-20">
      <div className="gutter">
        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Link
              href="/"
              className="-my-2 flex min-h-11 items-baseline gap-1.5 py-2 text-body font-medium tracking-tight text-ink"
            >
              OpenAgent
              <span aria-hidden="true" className="text-body-sm text-ash">
                ⌘
              </span>
            </Link>
            <p className="mt-4 max-w-[34ch] text-body-sm text-smoke">
              An open-source personal AI execution environment for macOS.
              Instinct thinks. OpenAgent acts.
            </p>
            <p className="mt-6 font-mono text-caption uppercase text-smoke">
              MIT licensed · active beta
            </p>
          </div>

          <div className="lg:col-span-3">
            <h2 className="font-mono text-caption uppercase text-smoke">
              Documentation
            </h2>
            <ul className="mt-3 space-y-1 lg:mt-4 lg:space-y-3">
              {docLinks.map((d) => (
                <li key={d.href}>
                  <External href={d.href}>{d.label}</External>
                  <p className="text-micro text-smoke">{d.blurb}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="font-mono text-caption uppercase text-smoke">
              This site
            </h2>
            <ul className="mt-3 space-y-0 lg:mt-4 lg:space-y-3">
              {pages.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className="flex min-h-11 items-center text-body-sm text-graphite transition-colors duration-200 hover:text-ink pointer-fine:inline-block pointer-fine:min-h-0 pointer-fine:py-0.5"
                  >
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h2 className="mt-10 font-mono text-caption uppercase text-smoke">
              Project
            </h2>
            <ul className="mt-3 space-y-0 lg:mt-4 lg:space-y-3">
              {project.map((p) => (
                <li key={p.href}>
                  <External href={p.href}>{p.label}</External>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="font-mono text-caption uppercase text-smoke">
              Built with
            </h2>
            <ul className="mt-3 space-y-1 lg:mt-4 lg:space-y-3">
              {credits.map((c) => (
                <li key={c.href}>
                  <External href={c.href}>{c.name}</External>
                  <p className="text-micro text-smoke">{c.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-stone pt-6 sm:mt-14">
          <p className="text-micro text-smoke">
            OpenAgent integrates with Instinct AI, a separate product, and runs
            entirely on your own machine.
          </p>
          <p className="font-mono text-caption uppercase text-smoke [overflow-wrap:anywhere]">
            github.com/GitCoder052023/OpenAgent
          </p>
        </div>
      </div>
    </footer>
  );
}
