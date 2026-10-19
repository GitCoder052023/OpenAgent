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

## Deployment

Set `NEXT_PUBLIC_SITE_URL` to the origin the site is served from. It backs the
canonical URLs, Open Graph tags, `sitemap.xml` and `robots.txt`; without it
those fall back to `http://localhost:3000`.

```bash
NEXT_PUBLIC_SITE_URL=https://example.com pnpm build
```
