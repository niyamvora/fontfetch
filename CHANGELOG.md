# Changelog

All notable changes to fontfetch will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **`pull()` accepts an optional `onProgress` callback** in `PullOptions`. Receives structured `PullProgressEvent` updates as the pipeline runs — `phase` transitions (`fetch_html` / `parse_css` / `extract_faces` / `download` / `classify` / `done`), per-stylesheet `css_fetched` / `css_failed`, `faces_found` with face + file counts, per-file `file_downloaded` / `file_failed`, `orphan`, `classified` totals, `aborted_all_commercial`, and a terminal `done`. Designed for non-CLI consumers (webapps, build tools) that want to stream progress to a UI instead of scraping log lines.
- `PullProgressEvent` exported as a public type from `@fontfetch/core`.

### Changed
- Nothing. The CLI ignores `onProgress` and keeps logging to stdout exactly as before. The change is purely additive — existing consumers see no behaviour difference.

### Notes
- 54/54 vitest cases unchanged.
- This release is staged on `main` but not yet bumped on npm. When published it'll go out as **1.1.0** — minor bump, additive surface.

## [1.0.0] — 2026-05-27

### Changed
- **Monorepo restructure (pnpm workspaces).** `src/` is gone from the repo root; the codebase now lives in two packages and is ready to host the v0.5 webapp + headless worker without further restructuring.
  - `packages/core/` — `@fontfetch/core`, the shared pipeline (parse, license, provenance, emitters, `pull()`, optional `headless`). Workspace-only; not published.
  - `packages/cli/` — `fontfetch`, the npm package. Single bundled file via `tsup` (`noExternal: ['@fontfetch/core']`), so installed users see zero workspace plumbing.
  - `apps/web/` and `apps/worker/` — empty placeholders for the v0.5 webapp and v0.5.x headless service. Both will import from `@fontfetch/core`.
- Tooling switched from npm to **pnpm@9** (`packageManager` pinned in the root `package.json`). CI + release workflows updated accordingly; `package-lock.json` is replaced by `pnpm-lock.yaml`.
- Root `tsconfig.json` is now a TypeScript Project References pointer; per-package `tsconfig.json` extends a shared `tsconfig.base.json`.
- Test fixtures, vitest config, and tsup config moved into the owning package.
- The published `bin` path moved from `./dist/cli.js` to `./packages/cli/dist/cli.js` inside the repo. The npm package's own `bin` is unchanged (`./dist/cli.js` relative to the published tarball).

### Migration notes
- **For users of the CLI**: no change. `npx fontfetch <url>` works exactly as before; the published package shape is identical.
- **For contributors**: `npm install` → `pnpm install`. `npm run X` → `pnpm run X`. Per-package: `pnpm --filter @fontfetch/core test`.
- **For future webapp/worker work**: import from `@fontfetch/core`; deep imports outside the re-exported public API (`packages/core/src/index.ts`) are unsupported and may break.

### Why this version is 1.0
- The package layout is now stable. Adding the webapp and headless worker no longer requires a restructure — they slot into `apps/`.
- The public API of `@fontfetch/core` is locked behind `index.ts`. Future minor versions extend it; breaking changes go in a 2.0.

## [0.6.0] — 2026-05-27

### Added
- **Provenance grouping.** Every downloaded font now lives under `files/<bucket>/<name>`, where bucket is one of `google` / `adobe-typekit` / `commercial` / `open-cdn` / `self-hosted`. Same first-match-wins precedence as the license heuristic; same-origin URLs (with `www.` and subdomain handling) fall to `self-hosted`.
- New module `src/provenance.ts` with `bucketForUrl(url, pageHost)` and `sameOrigin(a, b)` helpers.
- 18 unit tests for bucketing and same-origin detection.

### Changed
- **Breaking layout change** (no published consumers): font files moved from `files/*.woff2` to `files/<bucket>/*.woff2`. `fonts.css`, `fonts.json`, `LICENSE_REVIEW.md`, and every framework emitter now reference the bucketed paths automatically.
- Per-file progress log prefixes the bucket: `✓ google/Inter-Regular.woff2` instead of `✓ Inter-Regular.woff2`.

### Notes
- v0.5 was originally scoped as a static `preview.html`. We've decided to skip that and roll it into a much larger v0.5 — a hosted Next.js webapp at `fontfetch.dev` with live progress, foundry-style previews, side-by-side compare, and font-pairing. See [docs/roadmap.md](docs/roadmap.md#v05--hosted-webapp) for the public plan.

## [0.4.0] — 2026-05-27

### Added
- **License heuristic + `LICENSE_REVIEW.md`**. Every pull now classifies each face as `open`, `commercial`, or `unknown` based on a URL-signature heuristic (Adobe Typekit, Monotype `fast.fonts.net`, Hoefler `cloud.typography.com`, Type Network, Adobe Fonts) plus a family-name fallback against a curated SIL OFL / Google Fonts catalog snapshot. Result is written as `LICENSE_REVIEW.md` alongside the rest of the per-site bundle.
- **Fail-fast on all-commercial sites.** When every detected face is served from a known commercial-foundry CDN, fontfetch aborts before downloading. It still emits `LICENSE_REVIEW.md` so the user can see what was detected, and prints a clear message recommending `--force` if they have a legitimate reason to proceed.
- **`--force` flag.** Bypasses the fail-fast check. Mirrors `npm install --force` semantics — you're telling the tool "I know what I'm doing."
- 12 new unit tests for the classifier and summarizer (`test/license.test.ts`).

### Changed
- CLI summary line at the end of a successful run now shows the license breakdown (`open / commercial / unknown` counts).

### Notes
- The classifier is heuristic-only and conservative on purpose — false-commercial is a safer failure mode than false-open (which could mislead a user into shipping a paid font).
- Adding a CDN signature is a one-line change in [src/license-data.ts](src/license-data.ts). PRs welcome.

## [0.3.0] — 2026-05-27

### Added
- **`--emit <targets>` flag**. Comma-separated framework targets emitted alongside the default `fonts.css`:
  - `next` → `next.fonts.ts` using `next/font/local`, one `localFont` call per family with all weights/styles, plus a CSS variable per family ready to spread into `<html>`
  - `tailwind` → `tailwind.fonts.ts` with `fontFamily` mapped into `sans` / `serif` / `mono` (heuristic) plus per-family aliases. Pairs with `--emit next` for CSS variables
  - `vite` → `vite.fonts.md` with a copy-paste integration guide
  - `css` → default (no-op flag; just makes the default explicit)
- Multiple targets allowed: `--emit next,tailwind` emits both
- `--emit=next,tailwind` (equals form) also accepted
- New `src/emitters/` module with one file per target, a shared `util.ts`, and a typed `Emitter` interface
- Vitest test harness with unit tests for every emitter and the utility helpers
- CI now runs `npm run test` between typecheck and build

### Changed
- `tsconfig.json` now includes `test/**/*` so the test files are typechecked alongside source
- Bumped to v0.3.0

## [0.2.2] — 2026-05-27

### Changed
- **Referer-aware font downloads.** Every font request now sends a `Referer` header set to the originating page URL (the same header browsers send automatically when loading subresources). Many foundry CDNs and some self-hosted setups return 403 without it. Mirrors what we already do for stylesheet fetches.
- `fetchBuffer` in [src/utils.ts](src/utils.ts) now accepts an optional `headers` parameter, parallel to `fetchText`.

### Notes
- Out of scope: bypassing signed-URL or session-bound foundry protection. That's a v0.4 concern (fail-fast on known commercial CDNs).

## [0.2.1] — 2026-05-27

### Added
- **Orphan-file auto-download.** In `--headless` mode, font URLs observed in the browser's network log that aren't referenced by any parsed `@font-face` rule (typically from cross-origin stylesheets) are now downloaded automatically into `files/` and listed under a new `orphan_files` array in `fonts.json`.
- Per-site `README.md` now includes an "Orphan files" section explaining what they are and how to wire them up manually.

### Changed
- **`fonts.json` shape**: previously a top-level `FontFace[]` array; now an object `{ faces: FontFace[], orphan_files: { file, url }[] }`. Pre-1.0 — no existing consumers — so no migration path was provided.

## [0.2.0] — 2026-05-27

### Added
- **`--headless` flag** — Playwright/Chromium mode that catches JS-loaded fonts, late-injected `@font-face` rules, and SPA-rendered content. Merges results with the static parser; dedupes faces across both sources.
- New `src/headless.ts` module with dynamic import of Playwright (graceful fail if not installed).
- Network-response listener that also observes font URLs at the browser level (logged in v0.2; auto-downloaded in v0.2.1).
- Playwright is wired as an **optional peer dependency** — the static path stays zero-runtime-deps.

### Changed
- CLI help text and README document the new `--headless` flag and install steps.
- Bumped to v0.2.0.

### Notes
- Headless mode requires `npm install playwright` + `npx playwright install chromium` once per machine.
- Static mode is unchanged and still the default.

## [0.1.1] — 2026-05-27

### Added
- **Community font-pairing registry** at `pairings/` — JSON files describing fonts used by real websites, with free OFL alternatives for commercial fonts
- JSON Schema (`pairings/_schema.json`) with validation rules
- Issue template (`.github/ISSUE_TEMPLATE/font_pairing.yml`) for non-technical contributors — fill a form, drag a screenshot
- AI-agent prompt in `pairings/README.md` so anyone can use Claude/ChatGPT/Cursor to draft a pairing JSON
- CI workflow (`.github/workflows/validate-pairings.yml`) that validates new pairings against the schema on every PR
- Seed pairings: Stripe, Linear, Vercel
- Pairings data released under CC0 — public domain, reusable by any third-party tool

### Notes
- The CLI itself is unchanged in v0.1.1. This release ships repo infrastructure for the community registry.

## [0.1.0] — 2026-05-27

### Added
- Initial release.
- CLI: `fontfetch <url> [outDir]`
- Static `@font-face` parser: linked stylesheets, inline `<style>`, `<link rel="preload" as="font">`
- Per-site output folder with `files/`, `fonts.css` (local URLs), `fonts.json` manifest, and a human-readable `README.md`
- Collision-safe filenames across CDNs
- Node 18+, pure ESM, zero runtime dependencies
