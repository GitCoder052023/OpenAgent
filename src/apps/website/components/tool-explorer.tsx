"use client";

import { useMemo, useState } from "react";
import { toolCategories } from "@/lib/tools";

export function ToolExplorer() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return toolCategories;
    return toolCategories
      .map((c) => ({
        ...c,
        tools: c.tools.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.summary.toLowerCase().includes(q) ||
            t.args.some((a) => a.toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.tools.length > 0);
  }, [query]);

  const matches = filtered.reduce((n, c) => n + c.tools.length, 0);

  return (
    <>
      <div className="sticky top-16 z-40 border-y border-stone bg-eggshell/90 backdrop-blur-sm">
        <div className="gutter flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
          <label className="flex min-w-56 max-w-md flex-1 items-center gap-2">
            <span className="sr-only">Filter tools</span>
            <svg
              aria-hidden="true"
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              className="shrink-0 text-ash"
            >
              <circle
                cx="5.5"
                cy="5.5"
                r="4"
                stroke="currentColor"
                strokeWidth="1"
              />
              <path d="M8.6 8.6L12 12" stroke="currentColor" strokeWidth="1" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, description or argument"
              className="w-full bg-transparent py-1 font-mono text-code text-ink outline-none placeholder:text-smoke"
            />
          </label>

          <p
            aria-live="polite"
            className="tabular shrink-0 font-mono text-caption uppercase text-smoke"
          >
            {query.trim()
              ? `${matches} matching`
              : `${matches} tools · 9 engines`}
          </p>
        </div>
      </div>

      <div className="gutter pb-24 lg:pb-32">
        {filtered.length === 0 ? (
          <div className="border-t border-stone py-20 text-center">
            <p className="text-body text-graphite">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
            <p className="mt-2 text-body-sm text-smoke">
              Try a tool prefix such as browser_, whatsapp_ or social_.
            </p>
          </div>
        ) : null}

        {filtered.map((category) => (
          <section
            key={category.slug}
            id={category.slug}
            className="scroll-mt-32 pt-20 lg:pt-24"
          >
            <div className="grid gap-x-16 gap-y-4 border-t border-stone pt-7 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <h2 className="text-heading-sm text-ink">{category.label}</h2>
                <p className="mt-2 font-mono text-caption uppercase text-smoke">
                  {category.tools.length} tools · {category.builtOn}
                </p>
              </div>
              <p className="text-body-sm text-smoke lg:col-span-8">
                {category.intro}
              </p>
            </div>

            <table className="mt-8 w-full border-collapse text-left">
              <caption className="sr-only">
                {category.label} tools, with their key arguments.
              </caption>
              <thead>
                <tr className="border-b border-stone">
                  <th
                    scope="col"
                    className="w-44 pb-2 pr-4 font-mono text-caption font-normal uppercase text-smoke lg:w-56"
                  >
                    Tool
                  </th>
                  <th
                    scope="col"
                    className="pb-2 pr-4 font-mono text-caption font-normal uppercase text-smoke"
                  >
                    What it does
                  </th>
                  <th
                    scope="col"
                    className="hidden w-64 pb-2 font-mono text-caption font-normal uppercase text-smoke md:table-cell lg:w-80"
                  >
                    Key arguments
                  </th>
                </tr>
              </thead>
              <tbody>
                {category.tools.map((tool) => (
                  <tr key={tool.name} className="border-b border-stone">
                    <th
                      scope="row"
                      className="py-4 pr-4 align-top font-mono text-code font-normal text-ink"
                    >
                      {tool.name}
                    </th>
                    <td className="py-4 pr-4 align-top text-body-sm text-smoke">
                      {tool.summary}
                      {tool.args.length ? (
                        <span
                          aria-hidden="true"
                          className="mt-2 block font-mono text-micro text-smoke md:hidden"
                        >
                          {tool.args.join(" · ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden py-4 align-top font-mono text-micro text-smoke md:table-cell">
                      {tool.args.length ? tool.args.join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
