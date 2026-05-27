# Roadmap

Versions are signals of scope, not promises of timing.

## v0.1 — shipping ✓

Static `@font-face` extraction. Per-site folder with `files/`, `fonts.css`, `fonts.json`, `README.md`.

## v0.1.1 — community font-pairing registry

A community-driven registry of font pairings used by real websites — with screenshots, font names, foundry info, and free OFL alternatives. The CLI itself doesn't change in this version; v0.1.1 ships the *repo infrastructure* for crowdsourced pairings.

### What ships

```
pairings/
├── README.md                    Contribution guide + schema overview
├── _schema.json                 JSON Schema (Draft 2020-12)
└── <site-slug>.json             One file per pairing

.github/ISSUE_TEMPLATE/
└── font_pairing.yml             Structured form for non-technical submitters

.github/workflows/
└── validate-pairings.yml        Runs ajv against _schema.json on PRs
```

### Schema (per pairing)

```json
{
  "site": "string (display name)",
  "url": "string (URL)",
  "submitter": "string (github handle, optional)",
  "screenshot": "string (relative path to png/jpg, optional)",
  "fonts": [
    {
      "family": "string",
      "role": "string (headline, body, code, ui, etc.)",
      "weights": "number[]",
      "foundry": "string (optional)",
      "license": "open | commercial | unknown",
      "free_alternatives": "string[] (font family names)"
    }
  ],
  "tags": "string[] (sans-serif, serif, mono, fintech, devtools, etc.)",
  "notes": "string (optional)"
}
```

### Submission flow

**Path A — Issue template (low friction):**
1. Contributor opens an issue from the "Submit a font pairing" template
2. Form fields prompt for URL, fonts, weights, alternatives, screenshot URL
3. Maintainer (or, later, a bot) converts to JSON in a PR
4. Schema validation runs in CI

**Path B — Direct PR (for git-comfortable contributors):**
1. Fork → add `pairings/<slug>.json` + optional screenshot under `pairings/screenshots/`
2. Open PR
3. Schema validation runs in CI
4. Merge

### Why this differentiates fontfetch

- **No existing OSS registry exists** — fonts-in-use.com and typewolf.com are paywalled / human-curated, not community-submittable
- **`free_alternatives` ties pairings back to the CLI mission** — "here's the commercial font, here's the OFL substitute you can actually ship"
- **Each pairing is an attribution credit** for the submitter — drives organic distribution
- **Machine-readable** — third parties can consume `pairings/*.json` as a data source (font-picker plugins, design tooling, etc.)

### Seed content for launch

Ship v0.1.1 with at least 5 seed pairings to prove the format works and give browsers something to look at on day one:
- Stripe (Söhne + Söhne Mono)
- Linear (Inter Display + Inter)
- Vercel (Geist + Geist Mono)
- Anthropic (Tiempos Headline + Styrene B)
- One Google-Fonts-only site (e.g., a popular Tailwind UI demo) to highlight the "100% open" path

### Future iterations

- **v0.1.2** — bot that auto-creates a PR from the issue template, removing the maintainer triage step
- **v0.1.3** — auto-generated `PAIRINGS.md` index in the repo root with a sortable table
- **v0.2+** — webapp at `fontfetch.dev` that renders pairings beautifully and lets you click "download with fontfetch" to run the CLI on that URL

## v0.2 — Playwright mode ✓ shipped

`--headless` flag. Spawns a headless Chromium, loads the page, awaits `document.fonts.ready`, dumps every accessible `@font-face` rule from `document.styleSheets`, and merges with the static parser.

Catches:
- Adobe Typekit (`use.typekit.net`)
- Cloudflare-protected sites
- SPAs that load fonts after hydration
- Fonts injected by JS at runtime

Playwright stays a `peerDependencies` install with `optional: true` — the static path keeps zero runtime deps.

### v0.2.1 — cross-origin networking ✓ shipped

In headless mode the browser network listener captures font URLs that bypass our static parser — usually because the stylesheet is cross-origin and `cssRules` throws (Adobe Typekit, some CDN-hosted CSS). v0.2.1:

- Auto-downloads orphan URLs alongside the rest into `files/`
- Lists them under a new `orphan_files` array in `fonts.json`
- Notes them in the per-site `README.md` with manual `@font-face` instructions
- Manifest shape changed from `[FontFace, ...]` to `{ faces: [...], orphan_files: [...] }` (pre-1.0, no existing consumers)

### v0.2.2 — Referer-aware font downloads ✓ shipped

`fetchBuffer` in [packages/core/src/utils.ts](../packages/core/src/utils.ts) now accepts an optional `headers` map and `pull.ts` passes `{ Referer: <page url> }` for every font request. Mirrors the browser default and the existing stylesheet-fetch behaviour. Unblocks foundry CDNs and self-hosted setups that 403 without a Referer.

Out of scope: bypassing signed-URL or session-bound protection used by commercial foundries — that's a different problem, addressed proactively in v0.4.

## v0.3 — framework emitters ✓ shipped

`--emit <target,target,...>`. Targets shipped in v0.3:

- `next` — `next.fonts.ts`: one `localFont` call per family, all weights/styles, plus a `--font-<family>` CSS variable
- `tailwind` — `tailwind.fonts.ts`: `sans` / `serif` / `mono` bucket assignment (heuristic on family name) + per-family aliases. Designed to pair with `--emit next` for the CSS variables
- `vite` — `vite.fonts.md`: integration guide (Vite needs no plugin; the default `fonts.css` is already a drop-in stylesheet)
- `css` — explicit no-op for the default

Multiple targets allowed: `--emit next,tailwind`.

### v0.3.x — deferred targets

- **`astro`** — almost identical to `vite`; deferred until there's actual demand
- **Variable-font collapsing** — if multiple weights of the same family are actually subsets of one variable font, we currently emit them separately. A future emitter pass could detect this and use `next/font/local`'s variable-font support

## v0.4 — license heuristic ✓ shipped

Every pull writes `LICENSE_REVIEW.md` next to the rest of the per-site bundle. Each face is classified as:

- ✅ **Open / self-hostable** — URL matches a known open CDN (Google Fonts, Fontsource, jsdelivr Google Fonts mirror) OR the family is on a curated SIL OFL / Google Fonts catalog snapshot
- ⚠️ **Commercial foundry** — URL matches a commercial CDN (Adobe Typekit `use.typekit.net` / `p.typekit.net`, Monotype `fast.fonts.net`, Hoefler `cloud.typography.com`, Type Network `cloud.typenetwork.com`, Adobe Fonts, Font Awesome paid)
- ❓ **Unknown** — no signature match

URL signatures take precedence over family-name match, so 'Inter served from Typekit' classifies as commercial (someone is licensing it).

**Fail-fast on all-commercial sites.** When every detected face classifies as commercial, fontfetch aborts before downloading, emits only `LICENSE_REVIEW.md`, and tells the user to pass `--force` if they have a legitimate reason. Mirrors `npm install --force` semantics.

Not legal advice. Conservative on purpose: false-commercial is a safer failure mode than false-open. Adding a CDN signature is a one-line change in [packages/core/src/license-data.ts](../packages/core/src/license-data.ts).

## v0.5 — hosted webapp

The original v0.5 was a static `preview.html` per site. We're trading that up for something much bigger: a **hosted Next.js webapp at `fontfetch.dev`** that puts every CLI capability behind a designed-for-humans UI.

### What it does

1. **Paste a URL** — single input, validated client-side
2. **Live progress** — animated stepper with each pipeline phase:
   - Fetching HTML
   - Parsing N stylesheets
   - Found M @font-face declarations
   - Downloading K/M files
   - Classifying licenses
   - Ready
3. **Foundry-style preview** — click any font, see it presented like a Klim or Commercial Type product page:
   - Big editable sample text + pangram preset
   - Size slider, weight selector, italic toggle
   - Letter-spacing + line-height sliders
   - Sample paragraph + glyph grid + numerals/symbols block
4. **Compare** — pick two fonts (from the same site or different ones), see them side by side with synced controls
5. **Pairing** — pick one font as headline + another as body, see them composed in a realistic layout. Save the pairing → submits to the [community registry](../pairings)
6. **Bundle download** — ZIP of `files/`, `fonts.css`, `fonts.json`, `LICENSE_REVIEW.md`
7. **License badge** — `open / commercial / unknown` counts prominent everywhere a font appears

### Stack (planned)

- Next.js 15 App Router + React 19 + TypeScript
- **shadcn/ui + Tailwind CSS** for the component layer (well-documented, easy for contributors)
- Framer Motion / motion.dev for the stepper + preview transitions
- The current CLI library imported server-side from API routes
- Streaming progress via Server-Sent Events
- Headless mode delegated to a small worker (Render / Fly.io / Cloud Run) — Vercel serverless can't host Chromium
- Bundle storage on Cloudflare R2 (24h TTL)

### Why this matters more than `preview.html`

- A hosted entry point dramatically lowers the activation cost for non-CLI users
- The compare + pairing tools have no good open-source equivalent (typewolf is paywalled / human-curated)
- Drives traffic back to the community pairings registry
- Doubles as the project's marketing page

### Scope to ship as v0.5

1. URL paste → static-mode pull → progress UI → results page
2. Single-font preview view
3. Bundle download

### Deferred to v0.5.x

- Headless-mode toggle (needs the worker; gate behind a "show advanced" flag)
- Compare mode
- Pairing tool with registry submission
- Account-less history (localStorage)

## v1.0 — monorepo restructure ✓ shipped

The repo is now a pnpm-workspaces monorepo with two packages and two reserved
app slots. No CLI behaviour changes; this is the structural foundation the
v0.5 webapp and v0.5.x headless worker plug into without a second
restructure.

```
fontfetch/
├── packages/
│   ├── core/          @fontfetch/core — shared pipeline (workspace-only)
│   └── cli/           `fontfetch` — published npm package, single bundled file
├── apps/
│   ├── web/           Reserved for fontfetch.dev (v0.5)
│   └── worker/        Reserved for the Playwright headless service (v0.5.x)
└── pairings/, docs/, …
```

The published `fontfetch` package is unchanged from a consumer's perspective:
`tsup` inlines `@fontfetch/core` into the CLI's `dist/cli.js`, so npm users
see zero workspace plumbing. `@fontfetch/core` itself is workspace-only and
never published. The public surface of core lives behind
[packages/core/src/index.ts](../packages/core/src/index.ts); anything not
re-exported there is internal.

Contributor switch: `npm install` → `pnpm install`. CI + release pipelines
moved to pnpm@9. See [CHANGELOG.md](../CHANGELOG.md#100--2026-05-27) for the
full migration notes.

## v0.6 — provenance grouping ✓ shipped

Downloaded files are organised into subfolders by source:

```
downloaded-fonts/example.com/
└── files/
    ├── google/         Google Fonts CDN
    ├── adobe-typekit/  use.typekit.net / fonts.adobe.com
    ├── commercial/     Monotype / Hoefler / Type Network
    ├── open-cdn/       Fontsource, rsms.me, Google Fonts mirror
    └── self-hosted/    Same origin as the page (with www. + subdomain handling)
```

Same first-match-wins precedence as the license heuristic. Makes the "free vs licensed" split visible in the filesystem — useful when sharing a bundle with a teammate ("the google/ folder is safe to ship; the rest needs review"). Breaking change to output paths; pre-1.0, no published consumers.

## Stretch — programmatic API

Export a Node API for use in scripts / build steps:

```ts
import { pull } from 'fontfetch';
const result = await pull({ url, baseDir, headless: true, emit: ['next'] });
```

Useful for CI flows that auto-regenerate fonts from a design system docsite.

## Not on the roadmap

- Font modification / transformation. Different scope, different audience, legally murkier — separate tool if anyone wants to build it.
- Bypassing DRM, auth walls, or font-as-a-service streaming protocols.
- GUI. Maybe a webapp companion eventually, but not a desktop GUI.
