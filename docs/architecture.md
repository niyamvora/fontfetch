# Architecture

fontfetch is a pnpm-workspaces monorepo. The published `fontfetch` CLI is a
thin wrapper around the shared `@fontfetch/core` library — the same library
the v0.5 webapp imports from a Next.js Route Handler, and the same library
the v0.5.x headless worker will use.

> **Note on the webapp.** The public repo carries an `apps/web/` placeholder
> README only. The actual webapp source lives in the private
> [`fontfetch_fullstack`](https://github.com/niyamvora/fontfetch_fullstack)
> repo so the hosted product can evolve at its own pace. The CLI and
> `@fontfetch/core` remain fully open source and are what this document
> describes.

## Repo layout

```
fontfetch/
├── packages/
│   ├── core/          @fontfetch/core — pure pipeline, no I/O assumptions
│   │   ├── src/
│   │   │   ├── index.ts          Public API barrel
│   │   │   ├── pull.ts           Orchestrator
│   │   │   ├── parse.ts          HTML + @font-face regex parsing
│   │   │   ├── emit.ts           fonts.css / fonts.json / per-site README
│   │   │   ├── license.ts        Open / commercial / unknown classifier
│   │   │   ├── license-data.ts   Host + family signature tables
│   │   │   ├── provenance.ts     Bucket classifier (google / commercial / …)
│   │   │   ├── headless.ts       Optional Playwright entry (peer dep)
│   │   │   ├── formats.ts        Font-format allowlist (v1.3 --formats)
│   │   │   ├── codepoints.ts     Unicode-range parser + Google Fonts buckets (v1.3)
│   │   │   ├── inspect.ts        fontkit-driven terminal report (v1.2)
│   │   │   ├── subset.ts         DOM-scraped harfbuzzjs subset + range splitter (v1.2 / v1.3)
│   │   │   ├── fallback.ts       Capsize-driven CLS-killing fallback @font-face (v1.2)
│   │   │   ├── crawl.ts          --pages N multi-page link discovery (v1.2.1)
│   │   │   ├── nextjs.ts         _next/static/media subset sibling probe (v1.2.1)
│   │   │   ├── utils.ts          fetch, slugs, logging
│   │   │   ├── types.ts          FontFace / FontFormat / PullOptions / PullResult / …
│   │   │   └── emitters/         Per-framework emitters (next, tailwind, vite)
│   │   └── test/                 Vitest suite (mirrors src/)
│   └── cli/           `fontfetch` — the published npm package
│       └── src/cli.ts            Arg parsing → calls core.pull()
├── apps/
│   ├── web/           Reserved for the fontfetch.dev Next.js webapp (v0.5)
│   └── worker/        Reserved for the Playwright headless worker (v0.5.x)
├── pairings/          Community pairings registry (v0.1.1 ship)
├── docs/              Roadmap, architecture, webapp plan
├── pnpm-workspace.yaml
├── tsconfig.base.json Shared compiler options
├── tsconfig.json      Root — project references core
└── package.json       Monorepo root (private, no source)
```

## Pipeline (lives entirely in `@fontfetch/core`)

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

## Package boundaries

| Package | Publish? | Depends on | Imports `playwright`? |
|---|---|---|---|
| `@fontfetch/core` | No (workspace-only) | — | Optional peer dep, dynamic `import()` |
| `fontfetch` (CLI) | Yes (npm) | `@fontfetch/core` (bundled by tsup) | Inherits peer dep |
| `apps/web` (private — fontfetch_fullstack repo) | No (deployed to AWS ECS Fargate) | `@fontfetch/core` | No — delegates headless to worker |
| `apps/worker` (planned, private) | No (ECS Fargate sidecar) | `@fontfetch/core/headless` | Direct |

The CLI publishes as a single bundled file: `tsup` inlines `@fontfetch/core`
via `noExternal`, so npm consumers don't need any workspace machinery.
Playwright stays external and optional.

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
`GOOGLE_FONTS_RANGES` table in [packages/core/src/codepoints.ts](../packages/core/src/codepoints.ts), and emits one woff2 per bucket plus a chained
`fonts.subset.css`. The two flows share `subsetFont` (harfbuzzjs) and the
file-walking helper, but the orchestration is intentionally separate
because the mental models differ — render-aware subsetting vs.
ranged lazy-loading.

**Regex parser, not a real CSS AST.** `@font-face` is a constrained subset of
CSS, and the cost of pulling in postcss for one regex was not worth it.

**Zero runtime deps for the CLI.** The published `fontfetch` package is a
single bundled file. Playwright is an optional peer dep.

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
`<iframe>`): add a function in [packages/core/src/parse.ts](../packages/core/src/parse.ts)
that returns a list of `{text, base}` and wire it into `cssSources` in
[packages/core/src/pull.ts](../packages/core/src/pull.ts).

**Adding a framework emitter**: create
`packages/core/src/emitters/<name>.ts` exporting a function matching the
`Emitter` type. Register it in
[packages/core/src/emitters/index.ts](../packages/core/src/emitters/index.ts)
and add the target to `EMIT_TARGETS` in
[packages/core/src/emitters/types.ts](../packages/core/src/emitters/types.ts).

**Adding a license signature**: append to `OPEN_HOSTS`, `COMMERCIAL_HOSTS`,
or `KNOWN_OPEN_FAMILIES` in
[packages/core/src/license-data.ts](../packages/core/src/license-data.ts).
One-line change.

**Adding a provenance bucket**: extend the `Bucket` union and `RULES` table in
[packages/core/src/provenance.ts](../packages/core/src/provenance.ts).

**Adding a unicode-range bucket**: extend `GOOGLE_FONTS_RANGES` in
[packages/core/src/codepoints.ts](../packages/core/src/codepoints.ts). The
splitter picks up any new bucket automatically and the chained
`fonts.subset.css` emits a matching `@font-face` per family.

**Adding a font format**: extend the `FontFormat` union in
[packages/core/src/types.ts](../packages/core/src/types.ts) and the
`FONT_FORMATS` array + extension regex in
[packages/core/src/formats.ts](../packages/core/src/formats.ts).

**Consuming core from outside the CLI**: import from `@fontfetch/core`.
Public API is everything re-exported by
[packages/core/src/index.ts](../packages/core/src/index.ts) — `pull()`,
the classifier, the emitters, the types. Anything not re-exported is internal
and may change without a major bump.
