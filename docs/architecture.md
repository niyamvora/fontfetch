# Architecture

fontfetch is a pnpm-workspaces monorepo. The published `fontfetch` CLI is a
thin wrapper around the shared `@fontfetch/core` library — the same library
the v0.5 webapp imports from a Next.js Route Handler, and the same library
the v0.5.x headless worker will use. The v1.5 morph engine ships as a second
bundled library, `@fontfetch/morph`.

> **Note on the webapp.** The public repo carries an `apps/web/` placeholder
> README only. The actual webapp source lives in the private
> [`fontfetch_fullstack`](https://github.com/niyamvora/fontfetch_fullstack)
> repo so the hosted product can evolve at its own pace. The CLI,
> `@fontfetch/core`, and `@fontfetch/morph` remain fully open source and are
> what this document describes.

## Repo layout

```
fontfetch/
├── packages/
│   ├── core/          @fontfetch/core — pure pipeline, no I/O assumptions
│   │   ├── src/
│   │   │   ├── index.ts             Public API barrel
│   │   │   ├── types.ts             FontFace / FontFormat / PullOptions / PullResult / …
│   │   │   ├── headless.ts          Optional Playwright entry (peer dep)
│   │   │   ├── pipeline/
│   │   │   │   ├── pull.ts          Orchestrator (extract → download → emit)
│   │   │   │   ├── subset.ts        DOM-scraped harfbuzzjs subset + range splitter (v1.2 / v1.3)
│   │   │   │   ├── diff.ts          `fontfetch diff` — font-set delta between two URLs (v1.4)
│   │   │   │   └── audit.ts         `fontfetch audit` / `budget` — CI gate (v1.4)
│   │   │   ├── parse/
│   │   │   │   ├── parse.ts         HTML + @font-face regex parsing
│   │   │   │   ├── crawl.ts         `--pages N` multi-page link discovery (v1.2.1)
│   │   │   │   └── consistency.ts   Cross-page CONSISTENCY.md (v1.4)
│   │   │   ├── emit/
│   │   │   │   ├── emit.ts          fonts.css / fonts.json / per-site README
│   │   │   │   ├── gdpr.ts          `--gdpr-report` → GDPR.md / gdpr.json (v1.4)
│   │   │   │   └── emitters/        Per-framework emitters (next, tailwind, vite, tokens)
│   │   │   ├── license/
│   │   │   │   ├── license.ts       Open / commercial / unknown classifier
│   │   │   │   ├── license-data.ts  Host + family signature tables
│   │   │   │   ├── binary-license.ts name-table (ids 13/14) cross-ref (v1.3.1)
│   │   │   │   └── provenance.ts    Bucket classifier + provenance.json (v0.6 / v1.4)
│   │   │   ├── inspect/
│   │   │   │   ├── inspect.ts       fontkit-driven terminal report (v1.2)
│   │   │   │   ├── fallback.ts      Capsize-driven CLS-killing fallback @font-face (v1.2)
│   │   │   │   └── collapse.ts      Variable-font collapse hint (v1.4)
│   │   │   ├── formats/
│   │   │   │   ├── formats.ts       Font-format allowlist (v1.3 --formats)
│   │   │   │   └── codepoints.ts    Unicode-range parser + Google Fonts buckets (v1.3)
│   │   │   ├── platforms/
│   │   │   │   └── nextjs.ts        _next/static/media subset sibling probe (v1.2.1)
│   │   │   └── lib/                 fetch, slugs, logging
│   │   └── test/                    Vitest suite
│   ├── morph/         @fontfetch/morph — parametric morph engine (v1.5)
│   │   └── src/
│   │       ├── morph.ts             Top-level morph() orchestrator
│   │       ├── transforms/          round / width / slant / weight
│   │       ├── geometry.ts          corner-fillet + outline math (no external geometry dep)
│   │       ├── io.ts                loadFont / saveFont — opentype.js round-trip
│   │       ├── woff2.ts             WOFF2 decode/encode via wawoff2
│   │       ├── posture.ts           OFL / commercial gating (decideMorphPolicy)
│   │       └── naming.ts            renameFamily / applyWatermark
│   ├── registry/      @fontfetch/registry — typed pairings registry (v1.4, published)
│   ├── inspect/       @fontfetch/inspect  — interface facade, re-exports core (v1.5)
│   ├── subset/        @fontfetch/subset   — interface facade, re-exports core (v1.5)
│   ├── fallback/      @fontfetch/fallback — interface facade, re-exports core (v1.5)
│   └── cli/           `fontfetch` — the published npm package
│       └── src/cli.ts              Arg parsing → core.pull() / morph() dispatch
├── apps/
│   ├── web/           Placeholder README (real source in private fontfetch_fullstack)
│   └── worker/        Reserved for the Playwright headless worker (v0.5.x)
├── extensions/        GitHub Action, Raycast, Homebrew — outside the workspace (v1.4)
├── pairings/          Community pairings registry source (v0.1.1 ship)
├── examples/          Sample output folders
├── docs/              Roadmap, architecture, research notes
├── pnpm-workspace.yaml
├── tsconfig.base.json Shared compiler options
├── tsconfig.json      Root — project references
└── package.json       Monorepo root (private, no source)
```

## Extraction pipeline (lives entirely in `@fontfetch/core`)

```
URL
 │
 ▼
[fetchText]              ─── fetches the HTML
 │
 ▼
[parse: extract CSS]     ─── <link rel=stylesheet>, inline <style>, <link rel=preload as=font>
 │
 ▼
[fetchText × N]          ─── pulls every external stylesheet
 │
 ▼
[parse: @font-face]      ─── one descriptor per face: family, weight, style, src, unicode-range
 │
 ▼
[claim filenames]        ─── bucket-prefixed, collision-safe local names
 │
 ▼
[classify licenses]      ─── open / commercial / unknown; fail-fast if all-commercial
 │
 ▼
[fetchBuffer × N]        ─── downloads font files into files/<bucket>/
 │
 ▼
[emit]                   ─── fonts.css, fonts.json, README.md, LICENSE_REVIEW.md
                              + any --emit targets (next.fonts.ts, tailwind.fonts.ts, …)
```

## Morph pipeline (lives entirely in `@fontfetch/morph`, v1.5)

Morph is a separate **file in → file out** path; it does not touch the URL
extraction pipeline. `fontfetch morph <file>` loads a local binary, applies up
to four parametric transforms, gates on the input's license, and writes a real
font binary back out.

```
font file (TTF / OTF / WOFF / WOFF2)
 │
 ▼
[loadFont]               ─── opentype.js parse (WOFF2 → decode via wawoff2 first)
 │
 ▼
[decideMorphPolicy]      ─── classify input: OFL clean path vs commercial MOCKUP_ path
 │
 ▼
[transforms]             ─── width (matrix) · slant (shear) · round (fillet) · weight (offset, experimental)
 │
 ▼
[renameFamily/watermark] ─── enforce OFL Reserved Font Name rename; watermark commercial inputs
 │
 ▼
[saveFont]               ─── opentype.js write (→ WOFF2 encode via wawoff2 when requested)
```

## Package boundaries

| Package | Publish? | Depends on | Playwright? |
|---|---|---|---|
| `fontfetch` (CLI) | **Yes (npm)** | bundles `@fontfetch/core` + `@fontfetch/morph` + `opentype.js` (tsup `noExternal`); `wawoff2` runtime dep | Optional peer dep (`--headless`) |
| `@fontfetch/registry` | **Yes (npm)** | pairings baked at build time | No |
| `@fontfetch/core` | No (private workspace lib) | `fontkit`, `capsize` | Optional peer dep, dynamic `import()` |
| `@fontfetch/morph` | No (private; bundled into the CLI) | `opentype.js`, `wawoff2` | No |
| `@fontfetch/inspect` · `subset` · `fallback` | No (private interface facades; re-export `@fontfetch/core`) | `@fontfetch/core` | Inherited via core |
| `apps/web` (private — fontfetch_fullstack repo) | No (deployed to AWS ECS Fargate) | `@fontfetch/core` | No — delegates headless to worker |
| `apps/worker` (planned, private) | No (ECS Fargate sidecar) | `@fontfetch/core/headless` | Direct |

The CLI publishes as a single bundled file: `tsup` inlines `@fontfetch/core`,
`@fontfetch/morph`, and `opentype.js` via `noExternal`, so npm consumers don't
need any workspace machinery. `wawoff2` (the WOFF2 WASM codec) stays external —
its emscripten glue references `__dirname` and can't run inside an ESM bundle,
so it's a normal runtime dep, dynamically imported only when a morph actually
touches WOFF2. Playwright and `subset-font` stay external and optional.

> **On the v1.5 package split.** `@fontfetch/inspect`, `subset`, and `fallback`
> are **interface-first facades** — thin packages that re-export the matching
> surface from `@fontfetch/core` to mark a future public import boundary. They
> are `private` and are **not** published to npm today; the physical relocation
> of the implementations out of core (and any standalone publishing) is
> deferred. The single bundled `fontfetch` CLI remains the install — users get
> the whole package, no à-la-carte installs.

## Design choices

**Format filter runs after dedupe, before claim.** The v1.3 `--formats=woff2`
flag narrows each face's `src:` list right after the static + headless dedupe
pass and before any filename is claimed, so dropped faces never reach the
downloader. Preload-link URLs are filtered by extension at the same point so
the emitted preload header stays consistent with the emitted `fonts.css`.

**`--split-ranges` is a separate flow, not a knob on the existing subset.**
The default `subset` command takes the page's rendered codepoints and emits
one `<original>.subset.woff2`. `--split-ranges` skips the DOM scrape
entirely, opens each binary with `fontkit`, intersects against the
`GOOGLE_FONTS_RANGES` table in [packages/core/src/formats/codepoints.ts](../packages/core/src/formats/codepoints.ts), and emits one woff2 per bucket plus a chained
`fonts.subset.css`. The two flows share `subsetFont` (harfbuzzjs) and the
file-walking helper, but the orchestration is intentionally separate
because the mental models differ — render-aware subsetting vs.
ranged lazy-loading.

**Regex parser, not a real CSS AST.** `@font-face` is a constrained subset of
CSS, and the cost of pulling in postcss for one regex was not worth it.

**opentype.js for morph writes, fontkit for reads.** `fontkit` (used across
core for inspection, fallback metrics, and the variable-font summariser) is
read-only — its glyph-write surface is incomplete. The morph engine needs a
full round-trip, so `@fontfetch/morph` uses `opentype.js` for `loadFont` /
`saveFont` and reaches for `wawoff2` only when the input or output is WOFF2.

**Minimal runtime deps for the CLI.** The published `fontfetch` package is a
single bundled file (`@fontfetch/core` + `@fontfetch/morph` + `opentype.js`
inlined). Its only un-bundled runtime dependency is `wawoff2`, dynamically
imported the first time a morph touches WOFF2. `playwright` (`--headless`) and
`subset-font` (`subset`) are optional peer deps installed only when used.

**`headless.ts` lives in core, not the worker.** Both the CLI and the future
worker need it; centralising it keeps the Playwright behaviour identical
between local CLI runs and production webapp pulls. The webapp's own
container delegates headless work to a sibling ECS task rather than
shipping Chromium in every web-tier image.

**Optional `onProgress` callback in `pull()`.** Added in the post-1.0
release. Lets non-CLI consumers stream typed `PullProgressEvent` updates
to a UI without scraping logs. CLI ignores it; existing callers see no
behaviour change.

**Per-site, per-bucket output folder.** Multiple runs against different sites
don't collide; within a site, files are organised by source (`google/`,
`adobe-typekit/`, `commercial/`, `open-cdn/`, `self-hosted/`) so the
free-vs-licensed split is visible in the filesystem.

## Extension points

**Adding a new source of CSS** (e.g., shadow DOM, `<style>` inside
`<iframe>`): add a function in [packages/core/src/parse/parse.ts](../packages/core/src/parse/parse.ts)
that returns a list of `{text, base}` and wire it into `cssSources` in
[packages/core/src/pipeline/pull.ts](../packages/core/src/pipeline/pull.ts).

**Adding a framework emitter**: create
`packages/core/src/emit/emitters/<name>.ts` exporting a function matching the
`Emitter` type. Register it in
[packages/core/src/emit/emitters/index.ts](../packages/core/src/emit/emitters/index.ts)
and add the target to `EMIT_TARGETS` in
[packages/core/src/emit/emitters/types.ts](../packages/core/src/emit/emitters/types.ts).

**Adding a license signature**: append to `OPEN_HOSTS`, `COMMERCIAL_HOSTS`,
or `KNOWN_OPEN_FAMILIES` in
[packages/core/src/license/license-data.ts](../packages/core/src/license/license-data.ts).
One-line change.

**Adding a provenance bucket**: extend the `Bucket` union and `RULES` table in
[packages/core/src/license/provenance.ts](../packages/core/src/license/provenance.ts).

**Adding a unicode-range bucket**: extend `GOOGLE_FONTS_RANGES` in
[packages/core/src/formats/codepoints.ts](../packages/core/src/formats/codepoints.ts). The
splitter picks up any new bucket automatically and the chained
`fonts.subset.css` emits a matching `@font-face` per family.

**Adding a font format**: extend the `FontFormat` union in
[packages/core/src/types.ts](../packages/core/src/types.ts) and the
`FONT_FORMATS` array + extension regex in
[packages/core/src/formats/formats.ts](../packages/core/src/formats/formats.ts).

**Adding a morph transform**: add a module under
[packages/core/../morph/src/transforms/](../packages/morph/src/transforms) exporting a
transform that mutates the opentype.js font in place, and register it in
[packages/morph/src/morph.ts](../packages/morph/src/morph.ts).

**Consuming core from outside the CLI**: import from `@fontfetch/core`.
Public API is everything re-exported by
[packages/core/src/index.ts](../packages/core/src/index.ts) — `pull()`,
the classifier, the emitters, the types. Anything not re-exported is internal
and may change without a major bump.
