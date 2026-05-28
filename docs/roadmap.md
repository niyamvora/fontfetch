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

## v0.5 — hosted webapp (frontend ✓ shipped · backend in flight)

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
4. **Compare** — pick two fonts (from the same site or different ones), see them side by side with synced controls, plus a five-section specimen split (editable hero, paragraph, weight ladder, glyph grid, vital stats)
5. **Pairing** — pick one font as headline + another as body, see them composed in a realistic editorial layout. Save the pairing → submits to the [community registry](../pairings)
6. **Bundle download** — ZIP of `files/`, `fonts.css`, `fonts.json`, `LICENSE_REVIEW.md`
7. **License badge** — `open / commercial / unknown` counts prominent everywhere a font appears

### Frontend status — ✓ shipped (2026-05)

The Next.js 16 app in `apps/web/` is feature-complete on the UI side. Routes live for `/`, `/run/[id]`, `/run/[id]/font/[family]`, `/compare`, `/pair`, `/pairings`, and `/about`. Every page is responsive, dark/light themed (Vercel-aligned neutrals + a saffron accent), and renders against mock data in `src/lib/mock.ts` while the backend is wired.

Highlights:

- Editable specimen hero on `/` with a corner-mark URL paste card
- Live progress timeline on `/run/[id]` with motion-animated console + classification stripe (the SSE stream is simulated by a `SIM_PROFILE` array until M2 lands)
- Foundry-style preview with size / weight / tracking / leading sliders, glyph grid, paragraph specimen, file list, CSS source
- Five-section compare tool with synced controls
- Editorial pair tool wired to a "open registry PR" GitHub-issue link
- Pairings index grid (tag filter shown but not yet functional — see *Next up* below)

### Backend status — `/api/pull` SSE wired ✓ (R2 storage + rate-limit pending)

`POST /api/pull` is a Node-runtime SSE Route Handler that streams real progress events from `@fontfetch/core.pull()`. It enforces a URL guard (https-only, SSRF blocklist with DNS-resolution check) before invoking the pipeline. Tested end-to-end against `rsms.me/inter/` — extracts 5 families and 40 files in under 5s with full classification.

Still pending in this milestone:

- Bundle storage: write the per-session `files/`, `fonts.css`, `fonts.json` to S3 (or R2 — TBD on the AWS-native vs Cloudflare-native call given we're on ECS) and return a signed download URL on the `result` event
- Upstash Redis rate-limit (10 pulls/hour/IP)
- A persisted-session story so direct deep-links to `/run/[id]` and `/run/[id]/font/[family]` work after a page refresh (today they show a "not in memory" empty state)

### Stack (shipped)

- **Next.js 16** App Router + React 19.2 + TypeScript strict + Turbopack (production-default in 16)
- **Tailwind CSS v4** with OKLCH design tokens; no `tailwind.config.*` file
- **shadcn/ui** (`radix-nova` preset) — copy-paste primitives, no design-system wrapper layer
- **next-themes** — dark default, system-aware
- **motion.dev** — exponential ease-out only
- **Zustand** — staged for cross-tree state when the backend lands
- **Geist + Geist Mono** via `next/font/google`
- Headless mode (when M5 lands) delegated to a sidecar service running Playwright + Chromium in the same AWS ECS Fargate cluster as the webapp
- Bundle storage on Amazon S3 (or Cloudflare R2 — the ECS deployment doesn't lock us in) with a 24h object-lifecycle policy and signed download URLs

### Next up — v0.5 close-out

The frontend and the pull pipeline both work. The remaining gap is that `/compare` and `/pair` still draw from a hardcoded catalog instead of from the families the user actually pulls — fix that first, then close the storage + deploy story.

Detailed plan lives in the internal `webapp-plan.md`; the public-facing headlines:

1. **Make `/compare` and `/pair` dynamic** — store the last ~10 pulled `ResultSession` objects in localStorage; the picker becomes `[your pulls] [popular open] [search]`. Removes the "pull then dead-end" feeling.
2. **Bundle storage** — `s3://<bucket>/<sessionId>/...` with a 24h lifecycle; presigned URL on the `bundle_ready` SSE event; wires into the existing `BundleDownload` button.
3. **Redis session manifest** — store `{ id, url, families }` in Upstash Redis with a 24h TTL; new `GET /api/session/[id]` fallback so deep-links and refreshes work post-Zustand-cache-miss.
4. **Rate limit** — Upstash Redis per-IP token bucket, 10 pulls/hr/IP.
5. ~~`error.tsx` + `loading.tsx`~~ ✓ shipped for `/run/[sessionId]`
6. ~~`prefers-reduced-motion`~~ ✓ shipped via the `useReducedMotion` hook on the run-stepper
7. ~~Mobile nav menu~~ ✓ shipped — hamburger in `mobile-nav.tsx`
8. ~~Empty + error states on `/run/[id]`~~ ✓ shipped (loading skeleton, error boundary, "nothing to download")
9. **`noindex` on `/run/*`** via metadata
10. ~~Pairings tag filter functional~~ ✓ shipped — registry loads from `pairings/*.json` at build time, tag counts + `?tag=` URL state
11. **ECS deploy** — Dockerfile from `apps/web` standalone output → ECR → Fargate behind ALB at `fontfetch.dev`. Worker + API services join the same cluster later.
12. **`security-review` skill pass** before exposing `/api/pull` publicly

### Stretch — after the soft launch

- Headless mode toggle (needs `apps/worker`)
- Account-less history strip on `/` via localStorage (already wired in `recent-runs.ts`; just needs the real session IDs)
- Auth + saved sessions (`apps/api/` — see v0.7 below)
- OG image generation per pull (viral wedge; needs infra)

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

## v1.1 — OSS quick wins (planned)

Post-1.0 the CLI is structurally stable. v1.1 is a batch of small, individually-tweetable additions that close gaps every webfont user hits. Each item is < 1 day of work, ships in one minor release, and either fills a competitor gap or addresses a documented community pain point.

### Defaults that should already be there

- **`font-display: swap` in every emitted `@font-face`.** Currently absent. Sensible default; matches what `next/font` and Fontsource ship. The single most common Lighthouse-perf complaint about hand-rolled `@font-face` blocks is "I forgot font-display".
- **Computed `unicode-range` per file** in emitted `@font-face`. Read the cmap via `fontkit` once per font, emit a tight range. Saves bandwidth on multi-script sites and matches the Google Fonts splitting behaviour `google-webfonts-helper` is famous for.
- **`<link rel="preload" as="font" type="font/woff2" crossorigin>`** snippets in the emitted CSS comment block. Foot-gun-ridden enough that having it copy-pasteable next to the `@font-face` rules is high-value.
- **`--json` on every command.** Stable machine output unblocks every downstream integration (GH Action, Raycast, CI wrappers).

### New `--emit` targets

`webfont-dl` (333 stars, our direct competitor) ships zero framework emitters. Every new emitter is a separate SEO surface and a separate ride-along audience.

- **`--emit astro`** — Astro 4+ font config (`astro:assets` story is muddled; clean local-fonts block is welcome).
- **`--emit svelte`** — SvelteKit `+layout.svelte` + `app.css` pattern.
- **`--emit nuxt`** — Nuxt 4 + `@nuxt/fonts` (594 stars, active) interop. Generate a config that `@nuxt/fonts` consumes from local files rather than fetching from Google.
- **`--emit remix`** — Remix `links()` export + `app/styles/fonts.css`.
- **`--emit qwik`** — emit into `src/global.css` with `font-display: optional` per Qwik's perf gospel.
- **`--emit bunny`** — single-line snippet pointing at bunny.net Fonts (the quietly-winning GDPR-safe Google Fonts proxy) for the families that have a Bunny equivalent. Captures real workflow with near-zero code.

### Pairings registry — second-order value

The registry is mature data; we only need to extract more from it.

- **`fontfetch lookup <family>`** — reverse-search the local pairings: *"which sites use Inter Display?"*. Doubles the value of `pairings/` for free.
- **`fontfetch suggest <family>`** — given an extracted family, surface the registered OFL alternative(s) and the sites that proved the swap works in production. The "Söhne → Inter" pattern becomes a first-class CLI output.

### License signal upgrade

Today the classifier is URL-signature first, catalog-fallback second. v1.1 reads the binary too:

- **Name-table license fields** (IDs 13 + 14) via `fontkit`. A binary that self-declares `OFL-1.1` with a license URL boosts the classification confidence; a binary that declares a proprietary EULA flips an unknown to commercial.
- **RFN clause detection** — the OFL Reserved Font Name clause is the most-misunderstood OSS licence requirement in the space. Surface it explicitly in `LICENSE_REVIEW.md` per family.

## v1.2 — flagship "inspect + subset + fallback" release ✓ shipped (2026-05-28)

v1.2 is the **launch beat**. Three features ship together as one HN-front-page-worthy moment. Tag line: *"fontfetch 1.2: extract → inspect → ship. Zero CLS, zero unused glyphs, zero Python."*

### `fontfetch inspect <file>` — the missing terminal Wakamai Fondue

`wakamaifondue.com` is the gold standard for single-font inspection but is browser-only. `fontkit` (1.6k stars, last push Aug 2024 — semi-stale) is the underlying library but has no first-class CLI. There is no good terminal `inspect` command for woff2 files in the entire ecosystem. We fill it.

```
$ npx fontfetch inspect Inter-Variable.woff2
Inter Variable                                    96.4 KB woff2
─────────────────────────────────────────────────────────────
Glyphs       2,548          Family         Inter
Format       woff2          Subfamily      Regular
Embedded     Yes            Vendor         Rasmus Andersson
Axes         wght 100-900   slnt 0 to -10
Features     calt liga dlig ss01 ss02 ss03 cv01 cv02 tnum lnum onum
Scripts      latn cyrl grek vietn
License      OFL-1.1 (from name table id 13)
             https://github.com/rsms/inter
```

Output is screenshot-able by design. Glyph grid sample row is optional via `--glyphs`.

### `--fallback` — eliminate CLS in one flag

Today fontfetch emits the `@font-face` rules but says nothing about CLS. `fontaine` (1.9k stars, active) and Next's `next/font` solve this for their own ecosystems via `size-adjust` / `ascent-override` / `descent-override` / `line-gap-override`, but **no framework-agnostic CLI emits a zero-CLS fallback block today**. We do.

```
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107.4%;
  ascent-override: 90%;
  descent-override: 22.4%;
  line-gap-override: 0%;
}
```

Compute the four overrides per family using `capsize` (1.7k stars, the metrics-source-of-truth library `fontaine` and Next both depend on). Pick the closest system fallback per family heuristic (sans → Arial, serif → Times New Roman, mono → Courier New). Emit one fallback `@font-face` per real family, then update `font-family` declarations to `'Inter', 'Inter Fallback', sans-serif`.

Tagline: **"Zero-CLS webfonts in one command, no framework required."**

### `fontfetch subset <url>` — extract + use-driven subset in one pass

`glyphhanger` (878 stars, last push Feb 2024 — going stale) is the canonical answer for "scan a page, subset the fonts to the codepoints actually rendered." It requires a Python `fonttools` install, ships its own Puppeteer pipeline, and hasn't shipped a feature in two years. We already have a Playwright pass for `--headless`; layering a DOM glyph scrape on top costs us nothing structurally.

```
$ npx fontfetch subset https://stripe.com
… extracts as today
… scans rendered DOM for unique codepoints (3,212 of 8,941 supported)
… subsets each woff2 via subset-font (harfbuzzjs)
✓ files/google/Inter-Variable.subset.woff2          14.2 KB (was 96.4 KB)
✓ files/commercial/Sohne-Buch.subset.woff2          11.8 KB (was 78.0 KB)
```

Pure Node, WASM harfbuzz, no Python. Pairs with `--emit next/tailwind/...` so the subsetted files are what the framework config points to.

### Why these three together

Individually each is a single tweet. Together they're a complete narrative: *"You can extract any site's fonts (already shipped), inspect what you got (new), subset to what you actually use (new), emit a zero-CLS framework config (new + already shipped). Four seconds, one command."* That's a credible Show HN.

### v1.2 shipping notes

- `fontfetch inspect <file>` works on any woff2/woff/ttf/otf via the bundled `fontkit` dependency. RFN clause detection is layered on top of OFL detection. No CLI subcommand existed for this in the entire OSS landscape before today.
- `--fallback` on the default `pull` command emits `<Family> Fallback` faces using `@capsizecss/unpack` to read the binary's metrics. Default fallback is `Arial` (sans) / `Times New Roman` (serif) / `Courier New` (monospace) chosen by family-name heuristic. Best-effort and pure CSS — no JS runtime.
- `fontfetch subset <url>` chains the existing Playwright `--headless` pass with `subset-font` (optional peer dep, harfbuzzjs WASM). The page's rendered text — including `::before`/`::after` `content` for icon fonts — drives the codepoint set. Emits siblings as `<original>.subset.woff2`.
- Also folded in from v1.1: `font-display: swap` default on emitted faces and a `<link rel=preload>` hint header at the top of `fonts.css`.
- Test surface grew from 54 → 76 vitest cases (new: `inspect`, `fallback`, `emit-defaults`). All green.

The remaining v1.1 items (extra `--emit` targets, `fontfetch lookup` / `suggest`, full RFN-aware classifier upgrade, name-table license cross-ref) will land in **v1.2.x** point releases as they don't justify their own minor bump.

## v1.2.1 — discovery + empty-state quick wins ✓ shipped

Four small additions targeting the most common confusing outcomes of the v1.2 release. Each one fills a "fontfetch said 0 files but the page clearly has fonts" or "fontfetch said 1 file but the family is bigger than that" gap that came up immediately after v1.2 landed.

### Variable-font hint after the pull summary

After every download fontfetch inspects each binary on disk via `fontkit`. If any expose variation axes, the CLI prints a one-liner so users stop interpreting `1 unique file(s)` as a partial extraction:

```
→ Found 1 @font-face declaration(s), 1 unique file(s)
…
  ℹ One variable font detected: Saans (wght 300..900, ital 0..10).
    All weights and italic styles live in this single binary.
```

Multi-font runs collapse to one line per family, then a single closing sentence. Non-fatal — parse failures are swallowed because the download itself already succeeded. `PullResult` now carries `variableFonts: VariableFontSummary[]` for non-CLI consumers (the webapp uses this to badge variable-font tiles in the run timeline).

### Next.js `next/font` subset sibling probe

`next/font` ships per-subset binaries under `/_next/static/media/<hash>-s.<letter>.<ext>`, one letter per unicode subset (latin, latin-ext, cyrillic, greek, …). A page only loads the subset matching its `<html lang>`, so the static parser sees a single file even when the family is published across 8+ binaries.

v1.2.1 closes this. Any URL matching the pattern triggers an a-z HEAD probe of sibling letters in parallel (25 cancellable requests, ~150ms median). Letters that respond 2xx are claimed alongside the original and surfaced via a new `nextjs_siblings` progress event. Cheap, idempotent, and respects the existing Referer/UA conventions.

### `--pages <N>` multi-page crawl

`fontfetch <url> --pages=N` visits up to `N-1` same-origin internal links discovered in the entry HTML and merges fonts from all of them. Solves the "homepage loads Inter but `/blog` uses Tiempos" problem. Link discovery is intentionally shallow (one hop, no breadth-first expansion) and filters out anchors, `mailto:`/`tel:`/`javascript:` schemes, asset extensions (PDFs, images, font files, etc.), and the entry URL itself. Capped at `CRAWL_PAGE_CAP = 50` to keep runtime bounded.

```bash
fontfetch https://acme.com --pages=5         # homepage + 4 internal links
```

CSS dedupe is global across all pages, so a sitewide stylesheet is fetched once even if 20 pages reference it.

### Focused empty-state output

When `pull()` returns 0 declarations the CLI now prints a structured help frame instead of a single buried sentence. The suggestions adapt to the flags already in use:

```
→ Found 0 @font-face declarations.

  This is usually fixable. Try one of:
    --headless           (most likely fix: site loads fonts via JS)
    --pages=5            (the entry page might not reference all fonts)
  If the site is behind a login, fontfetch can't help.
```

`--headless` is suppressed if already enabled; `--pages=5` is suppressed once `--pages` is in play. If both are already on, the message pivots to "login wall" as the most likely remaining cause. A new `empty_help_hinted` progress event lets the webapp render the same frame in the SSE stream.

### v1.2.1 shipping notes

- 76 → 101 vitest cases (added `crawl`, `nextjs`, and inline axis formatter coverage). All green.
- The static-mode summary line still reads `→ Found N @font-face declaration(s), M unique file(s)` — the CSS-fetch loop was restructured to keep the count line above the per-stylesheet fetches even when crawling multiple pages.
- The monospace family-name heuristic in `--fallback` is unchanged. Promoted to v1.2.2 once we add `font.post.isFixedPitch` reading (capsize doesn't expose the flag through `fromBuffer`, so it needs its own `fontkit` round-trip).
- No new runtime dependencies. Bundle size unchanged at ~2.2 MB.

## v1.3 — shipped (2026-05-28)

Three additions that round out the subsetting pipeline — format allowlists, codepoint whitelists, and Google-Fonts-style per-language splitting. Each item maps to a real ask in the broader community:

### `--formats=<list>` — modern-only emit

Comma-separated allowlist on the default pull command (one or more of `woff2`, `woff`, `ttf`, `otf`, `eot`). Each face's `src:` list is narrowed to matching sources; faces with zero surviving sources are dropped with a warning rather than emitted broken. The preload-link URLs (`<link rel="preload" as="font">`) are filtered by extension at the same point so the preload header stays in sync.

```bash
fontfetch https://shinobidata.com --formats=woff2        # modern-only output, halves bundle size
fontfetch https://acme.com --formats=woff2,woff           # slight legacy reach
```

Matches the long-standing community ask in [glyphhanger #8](https://github.com/zachleat/glyphhanger/issues/8) — `Default change: --formats=woff2 only`.

Lives in a new `packages/core/src/formats.ts` module: `resolveFormat()` normalises CSS aliases (`truetype` → `ttf`, `opentype` → `otf`, `embedded-opentype` → `eot`) then falls back to the URL extension; `filterFacesByFormat()` narrows the parsed faces; `urlMatchesFormat()` handles the preload URLs. All three are re-exported from `@fontfetch/core`.

### `fontfetch subset --whitelist=<spec>` — extra codepoints to always keep

Extra codepoints to always include in the DOM-scraped subset, on top of whatever the page-walk produced. Accepts the canonical CSS `unicode-range` syntax (`U+00A0,U+20AC,U+0020-007F`) and an ergonomic `0x` shorthand (`0xA0,0x20AC`). Same shape as glyphhanger's `--whitelist=U+00A0` flag.

```bash
fontfetch subset https://stripe.com --whitelist=U+00A0,U+20AC
```

Use for dynamic content the static crawl can't see: currency variants, breaking-space, locale punctuation, icon-font glyphs injected by JS. Pairs cleanly with the existing `preserveRanges` option for whole-script preservation.

### `fontfetch subset --split-ranges` — Google-Fonts-style per-language emit

The flagship of v1.3. For every downloaded font, fontfetch opens it with `fontkit`, intersects its character set against the canonical Google Fonts buckets (`latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, `greek-ext`, `vietnamese`), and emits one woff2 per bucket whose overlap is at least `MIN_GLYPHS_PER_BUCKET` codepoints (5). A new `fonts.subset.css` is written next to the existing `fonts.css` with one `@font-face` per family per bucket carrying the matching `unicode-range:` declaration — interchangeable with what Google Fonts itself serves for a multi-script family.

```bash
fontfetch subset https://stripe.com --split-ranges
fontfetch subset https://stripe.com --split-ranges=latin,latin-ext,vietnamese
```

```
→ Step 2/2: splitting each font by Google Fonts language ranges
  ✓ google/Inter-Variable.latin.subset.woff2     14.2 KB (217 cp, −85%)
  ✓ google/Inter-Variable.latin-ext.subset.woff2  8.7 KB (179 cp, −91%)
  ✓ google/Inter-Variable.cyrillic.subset.woff2   6.1 KB (95 cp, −94%)
  ✓ google/Inter-Variable.vietnamese.subset.woff2 4.3 KB (148 cp, −96%)
  …
        + chained @font-face block emitted at downloaded-fonts/stripe.com/fonts.subset.css
```

Split-mode skips the DOM scrape by design: split-mode is about ranged lazy-loading, not page-content subsetting. The browser will fetch only the buckets it needs at runtime via the `unicode-range:` declarations.

Closes the long-standing positioning gap fontfetch had against [google-webfonts-helper](https://gwfh.mranftl.com/fonts) — fontfetch now produces equivalent output from arbitrary URLs, not just the Google Fonts catalog.

### v1.3 shipping notes

- No new runtime dependencies. The split flow reuses the existing `fontkit` runtime dep (already used by `inspect` and `--fallback`) and the `subset-font` peer dep (harfbuzzjs WASM).
- Bundle size unchanged at ~2.2 MB.
- New module: [packages/core/src/codepoints.ts](../packages/core/src/codepoints.ts) — `parseUnicodeRange()`, `formatUnicodeRange()`, and the canonical `GOOGLE_FONTS_RANGES` table captured verbatim from Google's `css2` endpoint. All re-exported from `@fontfetch/core`.
- New module: [packages/core/src/formats.ts](../packages/core/src/formats.ts) — format resolution + face-list filtering. Also re-exported.
- New types: `FontFormat`, `UnicodeRangeBucket`, `SplitFamilyReport`.
- Test surface grew from 101 → 130 vitest cases (new: `formats`, `codepoints`).
- The chained `fonts.subset.css` defaults to `font-weight: 400; font-style: normal` per face when only the binary is known (skipPull / orphan files). When `pullResult.faces` is populated (the typical case) the original weight/style is recovered automatically.

## v1.4 — distribution surface (planned)

Once v1.3 lands, the next gain is showing up where users already are. Each item below uses fontfetch as its engine and earns stars / installs by sitting in adjacent ecosystems.

- **`fontfetch-action` GitHub Action.** PR comments on font drift: *"`apps/web/app/page.tsx` references a new `@font-face` — fetched it, classified `Söhne` as commercial, +180 KB. Consider one of these OFL alternatives from the pairings registry."* Distribution flywheel; every adopting repo is a starred-adjacent signal.
- **`fontfetch diff <url1> <url2>`.** Detect font drift between two URLs (the staging-vs-prod use case, the rebrand-detect use case, the competitor-watch use case). The "Stripe rebrand: dropped Söhne, added Inter Display" tweet writes itself.
- **`fontfetch audit <url> --max-kb 100 --no-commercial`.** Drop-in CI command; non-zero exit if the homepage adds a commercial font or busts a budget. Pairs with the GH Action.
- **`fontfetch budget` for CI.** Per-family size budgets with `--json` for downstream tools (Lighthouse-CI lookalike, size-limit style).
- **Raycast extension.** *"fontfetch &lt;url&gt; → CSS to clipboard."* Designer-dev crossover audience; Raycast extensions show up in product roundups.
- **Homebrew tap.** `brew install fontfetch`. Once we cross ~500 stars, distribution maintenance pays off.
- **GDPR mode (`--gdpr-report`)**. Scan a URL, list every third-party font request (Google Fonts CDN, Adobe Fonts, Hatch, MyFonts CDN), output a `GDPR.md` checklist with one-line remediation per family. Direct ride-along on the German court ruling SEO wave.
- **Variable-font collapse hint.** When the extractor finds 9 static weight files plus a `.var.woff2` from the same family on the same CDN, recommend the variable file with a 1-line diff of the bundle size you'd save.
- **`@fontfetch/registry` typed package.** Publish a thin npm wrapper around `pairings/*.json` so third-party tooling (font pickers, design plugins) can consume the registry with autocomplete and types. Turns the registry into a real ecosystem primitive.

## Package layout (post v1.3)

The current monorepo holds `@fontfetch/core` and `fontfetch` (CLI). v1.2+ adds slim sibling packages — each consumable on its own but composed under the single `npx fontfetch` verb:

```
packages/
├── core/        existing — extraction + classification + emitters + pull()
├── cli/         existing — the published `fontfetch` binary
├── inspect/     new — name-table / axes / features / license-from-binary
├── subset/      new — Puppeteer DOM scrape + harfbuzzjs subset
├── fallback/    new — capsize-driven CLS-killing @font-face emitter
└── registry/    new — typed access to pairings/*.json
```

`fontfetch` CLI re-exports each sub-command (`fontfetch inspect`, `fontfetch subset`, `fontfetch fallback`, `fontfetch lookup`). The 90% of users only ever type `npx fontfetch`; the 10% who want primitives import from `@fontfetch/inspect` directly.

## v0.7 — accounts + saved sessions (planned)

Out-of-scope for v0.5 ship but mapped here so the architecture can absorb it without a rewrite.

- New workspace `apps/api/` for the backend (Hono or Next.js Route Handlers, Postgres or Turso for storage)
- OAuth sign-in (GitHub first, Google later)
- Per-user history of pulls (replaces the localStorage "recent runs" strip on `/`)
- "Save this pairing to my collection" on `/pair`, separate from the public registry submission
- Bundle TTL extended from 24h to "until the user deletes it" for signed-in users
- Stripe-gated higher rate limits when traffic patterns warrant it (not before)

Auth + storage live in the **private** fontfetch_fullstack repo only — they are not part of the open-source surface. The CLI and `@fontfetch/core` stay account-free forever.

## Stretch — programmatic API

Export a Node API for use in scripts / build steps:

```ts
import { pull } from 'fontfetch';
const result = await pull({ url, baseDir, headless: true, emit: ['next'] });
```

Useful for CI flows that auto-regenerate fonts from a design system docsite.

## Not on the roadmap

- **Font modification / transformation.** Different scope, different audience, legally murkier — separate tool if anyone wants to build it.
- **Bypassing DRM, auth walls, or font-as-a-service streaming protocols.**
- **GUI.** Maybe a webapp companion eventually, but not a desktop GUI.
- **Hosting / mirroring / proxying commercial fonts.** OFL fonts in `pairings/` reference free alternatives by name; we do not rehost Söhne / GT America / Inter Display / etc. Extract for the user's own licence-compliant use and stop there.
- **ML font classification / "vibe of a font".** Fontjoy died of this; bad ROI for an OSS tool that should be deterministic.
- **A general font registry that competes with Fontsource on Google Fonts.** Fontsource wins that lane. Our edge is arbitrary URLs, not the Google catalog.
- **Reverse lookup from images** (WhatTheFont clone). Requires a vision model and hosted inference — a different product, not a font extractor.
- **Building our own subsetter.** v1.2 `fontfetch subset` wraps `subset-font` / `harfbuzzjs`; we don't reinvent harfbuzz.
