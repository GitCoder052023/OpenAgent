# OpenAgent — website

The marketing and reference site for OpenAgent. Next.js 16 (App Router,
Turbopack) + React 19 + Tailwind CSS v4. Every route is statically prerendered.

```bash
pnpm install
pnpm dev                       # http://localhost:3000
pnpm build && pnpm start       # production build
pnpm lint
```

## Design

The visual system comes from the repository's own guides and is not improvised:

- **[`DESIGN.md`](../../../DESIGN.md)** supplies the palette, type scale,
  spacing, radii and component rules. The tokens live in
  [`app/globals.css`](app/globals.css) under `@theme`. Warm eggshell canvas,
  taupe bands, stone hairlines, black ink; display type is Inter at weight 300
  (the documented substitute for Waldenburg) and never bolded; Geist Mono
  carries technical micro-copy only. The violet spark `#0447ff` is reserved for
  product visuals and state — never buttons, links, badges or borders.
- **[`ANTI-AI-SLOP-DESIGN-GUIDE.md`](../../../ANTI-AI-SLOP-DESIGN-GUIDE.md)**
  governs composition. No card grids, no gradients, no glows, no floating
  shapes, no invented metrics, no fake product UI. Sections vary in structure
  deliberately: editorial split, comparison table, interactive replay, diagram,
  ledger, timeline, terminal, inverted essay.

Two deliberate extensions are documented in place: `--text-display-xl` widens
the measured type ramp for the hero only, and one inverted "night" band carries
the philosophy chapter.

Motion is explanatory or absent. The hero trace shows the microphone running
locally and only transmitting once woken; the architecture diagram draws its
flow lines in the direction data travels; the replay arrives in execution
order. All of it holds still under `prefers-reduced-motion`, which is read via
[`lib/use-reduced-motion.ts`](lib/use-reduced-motion.ts) rather than branching
during render.

## Content provenance

Nothing on the site describes a capability the project does not claim, and
anything unshipped is labelled `Shipping`, `Experimental` or `Direction`.

| File | Source | Regenerate |
| --- | --- | --- |
| [`lib/tools.ts`](lib/tools.ts) | `README.md` § Tool Suite | `python3 scripts/generate-tools.py` |
| [`lib/demo.ts`](lib/demo.ts) | README transcript + `docs/JARVIS_INSTRUCTIONS.md` | `python3 scripts/generate-demo.py` |
| [`lib/content.ts`](lib/content.ts) | `README.md`, `OPENINSTINCT_BRAIN_SPEC.md` | hand-maintained |

`lib/tools.ts` and `lib/demo.ts` are generated — edit the scripts, not the
output. `generate-demo.py` asserts its encoder against the worked example in
`docs/JARVIS_INSTRUCTIONS.md`, so every `JARVIS_CALL:…:END` string rendered on
the page is a genuine base64 encoding of the JSON printed beside it.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Product overview: definition, the gap, the request loop, engines, ghost mode, voice, install, vision, top questions |
| `/tools` | Every callable tool with its arguments, grouped by engine, filterable |
| `/faq` | 18 self-contained answers across four topics, with `FAQPage` structured data |
| `/privacy` | What stays local, what crosses the wire, what is written to disk, the six safeguards, the risks |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | Generated from `lib/seo.tsx` |
| `/llms.txt` | Factual project overview for AI crawlers, generated from the same data |
| `/opengraph-image` and one per route | Share cards rendered at build time by `lib/og.tsx` |

## SEO and AI discoverability

Everything below is generated from the same source of truth, so metadata,
structured data, `llms.txt` and visible copy cannot drift apart.

- **`lib/seo.tsx`** holds `productSummary` (the one-paragraph definition every
  surface derives from), the route table that drives the sitemap, the
  `pageMetadata()` helper, and the JSON-LD builders.
- **Structured data** is emitted as a single `@graph` per page. Site-wide
  nodes — `WebSite`, `SoftwareApplication`, `SoftwareSourceCode`, `Person` —
  come from the root layout; `BreadcrumbList` and `FAQPage` come from the
  pages. Only properties the repository can support are set: no ratings, no
  review counts, no adoption numbers. `offers` states the one price fact that
  is true — it is free.
- **FAQ answers are single self-contained paragraphs.** The same strings render
  as visible `<h3>` + `<p>` and feed the `FAQPage` schema, so what a crawler
  reads and what a person reads are identical. The five most common questions
  are repeated in full on `/`; the schema lives only on `/faq` so the two URLs
  do not compete for the same rich result.
- **`openGraph` is replaced, not merged**, by the deepest segment that defines
  it, which drops the file-based share card. Every page therefore names its own
  image, and each route has an `opengraph-image.tsx` beside its `page.tsx`.
- **Canonical and robots directives live on pages, not the layout**, so the 404
  response carries Next's injected `noindex` alone, with no canonical pointing
  at the home page.
- **No client-side rendering is required to read anything.** All 14 routes are
  statically prerendered; the animated replay is `aria-hidden` with a complete
  transcript in the markup beside it.

### Verifying

`scripts/` has no SEO tooling — these were one-off checks run against a
production build. Re-run them with any HTTP client:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain pnpm build && pnpm start
curl -s localhost:3000/robots.txt
curl -s localhost:3000/sitemap.xml
curl -s localhost:3000/llms.txt
curl -s localhost:3000/ | grep -o '<link rel="canonical"[^>]*>'
```

Paste a page's JSON-LD into the [Rich Results Test](https://search.google.com/test/rich-results)
and the [Schema Markup Validator](https://validator.schema.org/) before a
release that changes it.

## Deployment

Set `NEXT_PUBLIC_SITE_URL` to the origin the site is served from. It backs the
canonical URLs, Open Graph tags, `sitemap.xml`, `robots.txt` and `llms.txt`;
without it those fall back to `http://localhost:3000`. It is read at build
time, so it must be set for the build, not only the runtime.

```bash
NEXT_PUBLIC_SITE_URL=https://example.com pnpm build
```

After the first deploy to a real domain:

1. Verify the property in [Google Search Console](https://search.google.com/search-console)
   and [Bing Webmaster Tools](https://www.bing.com/webmasters), then submit
   `https://your-domain/sitemap.xml` in both.
2. Add the repository's `Website` field in GitHub so the two canonical
   destinations point at each other.
3. Confirm the host serves `/_next/static/*` with a long immutable
   `Cache-Control` and HTML with a short TTL. `next start` does this already;
   a CDN in front of it may not.
