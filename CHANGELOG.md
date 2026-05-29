# Changelog

All notable changes to fontfetch will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.4.0] — 2026-05-29

The "distribution surface + competitor-gap closeouts" release. Four engine-level additions that ship together and make fontfetch a release-gate tool, not just a dev convenience. Tag line: *"fontfetch 1.4: extract → audit → ship. With every page, every weight, and every font signal you didn't know you needed."*

After v1.4 the CLI covers four new release-gate surfaces (`diff`, `audit`, `budget`, `--emit tokens`), surfaces cross-page font drift with `CONSISTENCY.md`, emits per-weight Capsize fallbacks (closing the fontaine #53 gap that's been open 3+ years), and ships a stable machine-readable `provenance.json` for downstream tooling.

### Added

- **`fontfetch diff <urlA> <urlB>` — new subcommand.** Runs `pull()` on both URLs in parallel, emits a structured diff: added / removed / shared families, byte delta, commercial delta. Use for staging-vs-prod checks, rebrand detection, competitor watching. `--json` for CI.
  ```bash
  fontfetch diff https://staging.acme.com https://acme.com
  fontfetch diff https://staging.acme.com https://acme.com --json
  ```
  Powered by a new public export `diffPulls(urlA, urlB, baseDir, options)` returning a stable `FontDiff` shape.

- **`fontfetch audit <url> [flags]` — new subcommand.** Drop-in CI command. Non-zero exit when any configured rule is violated. Flags:
  - `--max-kb <N>` — total bundle byte budget
  - `--per-family-kb <list>` — per-family budgets, e.g. `Inter:30,Geist:40`
  - `--no-commercial` — fail if any face is classified commercial
  - `--json` — machine-readable output
  ```bash
  fontfetch audit https://acme.com --max-kb 200 --no-commercial
  fontfetch audit https://acme.com --per-family-kb Inter:50 --json
  ```
  Powered by a new public export `audit(url, baseDir, options)` returning a stable `AuditReport`.

- **`fontfetch budget <url> --max-kb N` — new subcommand.** Convenience around `audit` for the bundle-size dimension only. Same `--json` and non-zero-exit semantics as `audit`. Pairs with size-limit-style CI flows.

- **`--emit tokens` — W3C / DTCG design tokens emitter.** New target alongside `next` / `tailwind` / `vite`. Emits `fonts.tokens.json` with W3C Design Tokens Community Group ([tr.designtokens.org/format/](https://tr.designtokens.org/format/)) compatible token entries for every family + weight, plus a Tailwind-aligned size + line-height ladder. Consumed by Style Dictionary, Tokens Studio for Figma, Specify, and any tool that follows the DTCG draft.
  ```bash
  fontfetch https://vercel.com --emit tokens
  ```

- **Cross-page consistency report.** When `--pages > 1`, fontfetch now writes `CONSISTENCY.md` per pull listing shared-vs-divergent families across crawled pages. Surfaces the *"homepage uses Inter; /blog uses Tiempos; /pricing uses both"* problem that's been invisible since `--pages` shipped in v1.2.1. Zero competitors do this — none of them crawl multiple pages in the first place. New public exports: `computeConsistency`, `buildPageFaceMap`, `buildConsistencyReport`.

- **Per-weight Capsize fallback metrics.** `--fallback` now emits one `<Family> Fallback` block per (family, weight, style) tuple instead of one per family. Each block carries matching `font-weight` and `font-style` declarations so browsers select the right fallback per face. Beats `fontaine` on their core feature (fontaine #53 — open 3+ years). New public export `buildPerFaceFallbacks(filesDir, faces)`; the v1.2 `buildFallbacksForDir(filesDir)` remains available for direct callers that want family-wide fallback.

- **`provenance.json` per pull.** Stable, machine-readable schema (`schemaVersion: '1.0'`) carrying the v1.3.1-refined classifications + v0.6 provenance buckets + per-file byte sizes. Consumed by the new `audit` subcommand, the upcoming `fontfetch-action` GitHub Action, and any external CI / design-system tooling. The human-readable `LICENSE_REVIEW.md` is preserved unchanged. New public exports: `buildProvenanceJson()`, `ProvenanceReport`, `ProvenanceFaceEntry`, `ProvenanceFileEntry`.

- **`PullResult.consistency` and `PullResult.fileSizes`.** New optional fields surface cross-page consistency data and per-file byte counts to non-CLI consumers (the webapp, the audit/diff pipeline).

### Changed

- **CLI dispatch gains three new subcommands** (`diff`, `audit`, `budget`). Existing dispatch (`inspect`, `subset`, default `pull`) is unchanged.
- **`PullOptions.emit`** accepts `'tokens'` alongside the existing targets. Existing callers are unaffected.
- **`pull()` per-source face extraction** is preserved as a parallel `facesPerSource` array so the consistency report can attribute faces back to their page-of-origin. The flattened `faces` array is unchanged externally.

### Notes

- No new runtime dependencies. All four features compose on top of fontkit + capsize + the existing pipeline.
- Bundle size unchanged at ~2.2 MB.
- The new public exports follow the same stability guarantee as the rest of `@fontfetch/core`: additive changes only within a minor; shape changes require a major bump.
- `audit` runs the full `pull()` under the hood — no second-pass dry-run mode. For CI flows that need only the audit verdict and not the bundle, use `--json` and discard `outDir` after parsing the report.
- Test surface grew from 144 → 183 vitest cases (new: `provenance-json` with 8 cases, `tokens` emitter with 7 cases, `consistency` with 10 cases, `diff` with 3 cases, `audit` with 8 cases, plus 3 new `formatFallbackCss` per-weight cases).

## [1.3.1] — 2026-05-29

The "signal quality" point release. Two binary-driven refinements that close out the v1.2.x carryover queue: monospace detection now reads the `post` table instead of guessing from the family name, and the license classifier now cross-references the binary's OpenType `name` table before the final classification ships to disk. Plus, the OFL Reserved Font Name clause — the most-misunderstood OSS-font compliance pitfall — gets a first-class callout in `LICENSE_REVIEW.md`.

### Changed
- **`--fallback` reads `post.isFixedPitch` before falling back to the name regex.** Catches monospace families whose name doesn't say "mono" (Operator, PragmataPro, Comic Code, Berkeley Mono), so they get `Courier New` as their CLS fallback instead of `Arial`. Cheap — `fontkit` is already a runtime dep used by `inspect` and the variable-font summariser; the new path is one extra `create()` per family during `--fallback` computation.
- **License classifier cross-references the downloaded binary's `name` table (ids 13 + 14) after the URL-signature pass.** Conservative promotion only: `unknown` faces whose binary self-declares OFL flip to `open`; commercial classifications are never demoted (URL signature still wins); `open` classifications are preserved. Closes the v1.1 roadmap item that was queued for v1.2.x.
- **`LICENSE_REVIEW.md` now surfaces the OFL Reserved Font Name clause per family** when the binary's `name` table declares it. Worded as a callout (`⚠ OFL Reserved Font Name — do not redistribute modified copies under the name "<family>"`) so users don't accidentally violate the most-cited OFL compliance bug.

### Added
- New public export on `@fontfetch/core`: `crossRefLicenseFromBinaries(classified, filesDir) → ClassifiedFace[]` (from a new `license/binary-license.ts` module).
- `LicenseClassification` gains an optional `hasRFN?: boolean` field. Set by the cross-ref pass; consumed by `buildLicenseReview`.
- `InspectionReport` gains an `isFixedPitch: boolean` field. Read from `font.post?.isFixedPitch` (boolean or uint32 — both shapes are coerced).
- `pickGenericFallback(familyName, hint?)` accepts an optional `{ isFixedPitch?: boolean }` hint. When the hint forces `monospace`, the name regex is bypassed. The single-arg form remains supported.

### Notes
- No new runtime dependencies. The cross-ref pass reuses the existing `inspect()` helper; the fallback pass reuses the existing `fontkit` runtime dep.
- Bundle size unchanged at ~2.2 MB.
- The cross-ref pass is non-fatal: missing files, parse failures, and absent OpenType tables all degrade gracefully back to the URL-signature classification.
- Test surface grew from 132 → 144 vitest cases (new: `binary-license` with 6 cases, 3 new `pickGenericFallback` hint cases, 3 new `buildLicenseReview` RFN-callout cases). All green.

## [1.3.0] — 2026-05-28

Three additions that round out the subsetting pipeline: format allowlists, codepoint whitelists, and Google-Fonts-style per-language splitting. After v1.3, fontfetch covers URL → folder extraction, per-language splits, and modern-format emit in a single CLI with no Python dependency.

### Added
- **`--formats=<list>` on the default pull command.** Comma-separated allowlist of font formats to keep (one or more of `woff2`, `woff`, `ttf`, `otf`, `eot`). Each face's `src:` list is narrowed to matching sources; faces with zero surviving sources are dropped with a warning rather than emitted broken. Addresses a long-standing community ask for modern-format-only output. Default behaviour is unchanged — every format the upstream CSS provides is still kept when the flag is absent.
  ```bash
  fontfetch https://shinobidata.com --formats=woff2          # modern-only output, halves bundle size
  fontfetch https://acme.com --formats=woff2,woff             # slight legacy reach
  ```
- **`--whitelist=<spec>` on the `subset` subcommand.** Extra codepoints to always include in the subset on top of the DOM-walk result. Accepts the canonical CSS `unicode-range` syntax (`U+00A0,U+20AC,U+0020-007F`) and the more developer-ergonomic `0x` shorthand (`0xA0,0x20AC`). Pairs cleanly with the existing `preserveRanges` option for whole-script preservation.
  ```bash
  fontfetch subset https://stripe.com --whitelist=U+00A0,U+20AC
  ```
- **`--split-ranges` on the `subset` subcommand — Google-Fonts-style per-language emit.** For every downloaded font binary, fontfetch now opens it with `fontkit`, intersects its character set against the canonical Google Fonts buckets (`latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, `greek-ext`, `vietnamese`), and emits one woff2 per bucket whose overlap is at least `MIN_GLYPHS_PER_BUCKET` (5) codepoints. A new `fonts.subset.css` is written next to the existing `fonts.css` with one `@font-face` per family per bucket carrying the matching `unicode-range:` declaration — interchangeable with what Google Fonts itself serves for a multi-script family. The DOM scrape is skipped in split-mode by design (split-mode is about ranged lazy-loading, not page-content subsetting). Optional value restricts to named buckets: `--split-ranges=latin,latin-ext`.
  ```bash
  fontfetch subset https://stripe.com --split-ranges
  fontfetch subset https://stripe.com --split-ranges=latin,latin-ext,vietnamese
  ```
- New public exports on `@fontfetch/core`:
  - `FONT_FORMATS`, `isFontFormat`, `resolveFormat`, `filterFacesByFormat`, `urlMatchesFormat` (from a new `formats.ts` module)
  - `parseUnicodeRange`, `formatUnicodeRange`, `GOOGLE_FONTS_RANGES`, `MIN_GLYPHS_PER_BUCKET`, `expandBucket` (from a new `codepoints.ts` module)
  - Types: `FontFormat`, `UnicodeRangeBucket`, `SplitFamilyReport`
- New optional `PullOptions.formats` and `SubsetOptions.{ whitelist, splitRanges, splitBuckets }`. New optional `SubsetReport.{ splits, splitCss }` populated when `--split-ranges` is on.

### Notes
- No new runtime dependencies. The split flow reuses the existing `subset-font` peer dep (harfbuzzjs WASM) and the `fontkit` runtime dep that already powers `inspect` and `--fallback`.
- Bundle size unchanged at ~2.2 MB.
- The `--formats` filter is applied after the static + headless dedupe pass and before the filename-claim phase, so dropped faces never reach the downloader. Preload-link URLs (`<link rel="preload" as="font">`) are filtered by extension at the same point.
- Split-mode honours `pullResult.faces` to recover the original `font-weight` / `font-style` for each emitted `@font-face`. In `skipPull` mode (no parsed faces available) the chained CSS defaults to `400/normal` per face — the binaries are still split correctly; only the CSS metadata is best-effort.
- Test surface grew from 101 → 132 vitest cases (new: `formats` with 15 cases, `codepoints` with 16 cases). All green.

## [1.2.1] — 2026-05-28

The "discovery + empty-state" point release. Four small additions targeting the most common confusing outcomes after v1.2 shipped: silent variable-font collapses, partial Next.js subset captures, single-page entry blind spots, and the bare-bones "0 declarations found" terminal output.

### Added
- **Variable-font hint surfaced after the pull summary.** Every downloaded file is inspected once via `fontkit`; if any binary exposes variation axes, the CLI now prints a one-line notice (`ℹ One variable font detected: Saans (wght 300..900, ital 0..10). All weights and italic styles live in this single binary.`) so users stop interpreting `1 unique file(s)` as "the rest are missing". Multi-font runs get one line per variable family. Non-fatal — parse failures are swallowed because the download itself already succeeded.
- **Next.js `next/font` subset sibling enumeration.** Any URL matching `_next/static/media/<hash>-s.<letter>.<ext>` triggers an a-z HEAD probe across the sibling letters in parallel (25 cancellable requests, ~150ms). 2xx responders are claimed alongside the original. Captures the full multi-language family even when the visited page only loaded one unicode subset.
- **`--pages <N>` flag** for shallow multi-page crawls. Visits up to `N-1` same-origin internal links from the entry HTML (deduped, hash-stripped, asset-extension-skipped) and merges every page's `@font-face` rules and preload hints into the final bundle. Capped at `CRAWL_PAGE_CAP = 50`. Default `1` preserves the v1.2 behaviour. Solves the "homepage only loads Inter but `/blog` uses Tiempos" case.
- **Focused empty-state output.** When `pull()` finds zero `@font-face` declarations, the CLI now prints a 3-line "this is usually fixable" frame instead of a single buried sentence — `--headless` and `--pages=5` are suggested only when not already on, and the login-wall case is called out explicitly. Maps to a new `empty_help_hinted` progress event so the webapp can render the same hint in the run timeline.
- New public exports on `@fontfetch/core`: `discoverInternalLinks`, `CRAWL_PAGE_CAP`, `isNextjsSubsetUrl`, `parseNextjsSubsetUrl`, `nextjsSiblingCandidates`, `probeNextjsSiblings`, `summarizeVariableFonts`, `formatAxesInline`. Types: `CrawlOptions`, `NextjsSubsetMatch`, `VariableFontSummary`.
- New variants on `PullProgressEvent`: `page_fetched`, `page_failed`, `nextjs_siblings`, `variable_fonts`, `empty_help_hinted`, plus three new `phase` values (`crawl`, `probe_nextjs`, `inspect_variable`).
- New optional `PullOptions.pages` (default `1`). New fields on `PullResult`: `variableFonts`, `pagesCrawled`, `discoveredNextjsSiblings`.

### Notes
- 101/101 vitest cases pass (76 → 101). New tests cover the Next.js subset URL pattern + candidate generation, the internal-link discoverer (same-origin, asset-skip, dedupe, hash-strip, www-folding), and the inline axis formatter. The variable-font surface integration is covered structurally by the `summarizeVariableFonts` helper and the existing `inspect` tests.
- The monospace-family fallback heuristic in `--fallback` still uses the family-name regex from v1.2. Refining it to read `font.post.isFixedPitch` is queued for v1.2.x — capsize doesn't surface that flag in `fromBuffer`, so it needs its own `fontkit` round-trip and didn't justify shipping in this point release.
- Bundle size unchanged at ~2.2 MB. No new runtime dependencies.

## [1.2.0] — 2026-05-28

The "inspect + subset + fallback" release. Three flagship subcommands ship together: `fontfetch inspect` (terminal Wakamai Fondue), the `--fallback` flag (capsize-driven zero-CLS `@font-face` blocks), and `fontfetch subset` (Playwright DOM scrape + harfbuzzjs subset). Plus a batch of v1.1 quick wins folded in — `font-display: swap` default, `<link rel=preload>` hint emission, and a structured `onProgress` callback on `pull()` for non-CLI consumers.

### Added
- **`fontfetch inspect <file>` — terminal-native font inspector.** Reads any woff2/woff/ttf/otf file via `fontkit` and prints a column-aligned report: glyph count, format, units-per-em, variation axes, OpenType features, family/subfamily/PostScript names, vendor, copyright, and an SIL OFL detection that includes Reserved Font Name (RFN) clause awareness. Fills the gap between `wakamaifondue.com` (browser-only) and the canonical `fontkit` library (no first-class CLI).
- **`--fallback` flag on the default `pull` command.** For every extracted family we read the binary's metrics via `@capsizecss/unpack`, pick a system fallback (Arial / Times New Roman / Courier New) based on family-name heuristics, and emit a `<Family> Fallback` `@font-face` block with `size-adjust` / `ascent-override` / `descent-override` / `line-gap-override` matched to the primary's metrics. Output is framework-agnostic — works in any CSS, Tailwind v4, Next.js without `next/font`, Astro, plain HTML, etc. Solves the same CLS problem `fontaine` solves but without the Nuxt/Vite framework coupling.
- **`fontfetch subset <url>` — render-aware subsetting in one command.** Runs the full extraction pipeline, then loads the page in headless Chromium, walks every visible text node plus `::before`/`::after` pseudo-element `content`, and subsets each downloaded font to the unique codepoints actually rendered. Wraps `subset-font` (a WASM harfbuzzjs wrapper) so it works pure-Node — no Python `fonttools` install, unlike `glyphhanger`. Outputs siblings as `<original>.subset.woff2`.
- **`<link rel="preload" as="font" type="font/woff2" crossorigin>` hint block** at the top of every emitted `fonts.css`, one per primary cut. Saves users from the most common preload foot-gun (forgetting the `crossorigin` attribute causes the browser to double-download the font).
- **`pull()` accepts an optional `onProgress` callback** in `PullOptions`. Structured `PullProgressEvent` updates as the pipeline runs — `phase` transitions, per-stylesheet `css_fetched` / `css_failed`, `faces_found` with face + file counts, per-file `file_downloaded` / `file_failed`, `orphan`, `classified` totals, `aborted_all_commercial`, and a terminal `done`. Designed for non-CLI consumers (the fontfetch.dev webapp streams these as SSE events).
- New public exports on `@fontfetch/core`: `inspect`, `formatInspectionReport`, `computeFallback`, `formatFallbackCss`, `buildFallbacksForDir`, `pickGenericFallback`, `subset`, `buildPreloadHints`. Types: `InspectionReport`, `VariationAxis`, `FallbackMetrics`, `FallbackGenericFamily`, `SubsetReport`, `SubsetFileReport`, `SubsetOptions`, `PullProgressEvent`.

### Changed
- **Emitted `fonts.css` now defaults to `font-display: swap`** on every face when the source rule does not set one. Matches what `next/font` and Fontsource ship; eliminates the most common Lighthouse-perf complaint about hand-rolled `@font-face` blocks. An explicit `font-display` in the source rule is still preserved untouched.
- `buildFontsCss()` accepts an optional second arg (`{ preloadHints, extraBlocks }`) for the new comment header and fallback block emission. Backward-compatible — calling with one argument behaves exactly as before.

### Dependencies
- New runtime deps on `@fontfetch/core`: `fontkit ^2.0.4`, `@capsizecss/core ^4.1.3`, `@capsizecss/unpack ^4.0.0`. Required for `inspect` and `--fallback`.
- New **optional peer dependency**: `subset-font ^2.5.0` (the harfbuzzjs WASM wrapper). Same opt-in shape as `playwright` — `fontfetch subset` prints a clear `npm install subset-font` hint if it isn't on the resolver path.

### Notes
- 76/76 vitest cases pass. New tests cover `inspect` formatter, fallback heuristic + CSS shape, and the `font-display: swap` / `unicode-range` / preload-hint defaults in `buildFontsCss`.
- The published CLI bundle grows from ~250 KB to ~2.2 MB because `fontkit` is sizeable. Acceptable for a Node CLI; not a browser concern.
- Subset/fallback heuristics that ship in this minor release are best-effort. v1.2.1 will refine the monospace detection (currently name-only; needs the `post.isFixedPitch` flag) and the language-aware unicode-range presets.

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
