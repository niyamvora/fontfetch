# fontfetch

> Download every web font from any site into a project-ready folder — with CSS, manifest, and framework configs ready to drop in.

<p>
  <a href="https://www.npmjs.com/package/fontfetch"><img src="https://img.shields.io/npm/v/fontfetch.svg?style=flat-square" alt="npm" /></a>
  <a href="https://github.com/niyamvora/fontfetch/actions"><img src="https://img.shields.io/github/actions/workflow/status/niyamvora/fontfetch/ci.yml?branch=main&style=flat-square" alt="ci" /></a>
  <img src="https://img.shields.io/badge/license-MIT-black?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/node/v/fontfetch?style=flat-square" alt="node" />
</p>

```bash
npx fontfetch https://shinobidata.com
```

```
→ Fetching page: https://shinobidata.com
  3 external stylesheet(s), 0 inline <style> block(s)
→ Found 12 @font-face declaration(s), 18 unique file(s)
  ✓ Inter-Regular.woff2     (32,180 bytes)
  ✓ Inter-SemiBold.woff2    (28,044 bytes)
  ...
Done. 18/18 files saved to ./downloaded-fonts/shinobidata.com
```

That's it. Real font files, a ready-to-paste `fonts.css` with local URLs, a JSON manifest, and a README — all in one folder you can drag straight into `public/fonts/`.

---

## Why this exists

You're mocking up a design. You see a font you like on a marketing site. You want to test it locally for a few hours of iteration — not ship it to production, just see how your design feels with that typography.

The existing options aren't great:
- **`google-webfonts-helper`** — beautiful, but Google Fonts only
- **`webfont-dl`** — works, but you have to find the CSS URL yourself
- **Chrome extensions** — point-and-click, no automation, no project integration

**fontfetch** takes a URL. Returns a folder. That's the whole product.

## What you get

```
downloaded-fonts/
└── shinobidata.com/
    ├── files/                 ← raw woff2 / woff / ttf / otf
    │   ├── Inter-Regular.woff2
    │   ├── Inter-SemiBold.woff2
    │   └── ...
    ├── fonts.css              ← @font-face block with local URLs
    ├── fonts.json             ← manifest: family / weight / style / files
    └── README.md              ← human-readable summary, grouped by family
```

Drop the folder into `public/fonts/` (or wherever), link `fonts.css`, done.

## Install

Run on demand:

```bash
npx fontfetch <url>
```

Install globally:

```bash
npm install -g fontfetch
fontfetch <url>
```

Or pick the distribution channel that fits your workflow (v1.4):

```bash
# Homebrew tap (once published — see extensions/homebrew/)
brew install niyamvora/fontfetch/fontfetch

# GitHub Action (PR comments on font drift, CI release-gate)
# uses: niyamvora/fontfetch-action@v1
# See extensions/github-action/README.md

# Raycast extension (Cmd-Space → Extract Fonts from URL)
# See extensions/raycast/README.md

# Programmatic access to the pairings registry
npm install @fontfetch/registry
```

Requires Node 18+.

## Usage

```bash
fontfetch <url> [outDir] [--headless] [--pages <N>] [--fallback] [--emit ...] [--formats ...] [--force]
fontfetch inspect <font-file>
fontfetch subset <url> [outDir] [--whitelist <spec>] [--split-ranges[=<buckets>]]
fontfetch diff <urlA> <urlB> [outDir] [--json]                              # v1.4
fontfetch audit <url> [--max-kb N] [--per-family-kb F:N,...] [--no-commercial] [--json]   # v1.4
fontfetch budget <url> --max-kb N [outDir] [--json]                         # v1.4
```

| Arg / Flag | Default | Notes |
|---|---|---|
| `<url>` | — | Page to download fonts from (use the page where the font is actually rendered) |
| `[outDir]` | `./downloaded-fonts` | Per-site subfolder is created inside this |
| `--headless` | off | Launch Playwright/Chromium to also catch JS-loaded fonts |
| `--pages <N>` | `1` | Crawl up to N pages (entry + N-1 same-origin internal links) and merge fonts across all of them (v1.2.1). Max 50 |
| `--formats <list>` | — | Comma-separated allowlist of font formats to keep: `woff2`, `woff`, `ttf`, `otf`, `eot`. Faces with no matching source are dropped (v1.3). Default: keep every format the upstream CSS provides |
| `--fallback` | off | Emit a CLS-killing `<Family> Fallback` `@font-face` per family, with `size-adjust` / `ascent-override` / `descent-override` / `line-gap-override` matched via capsize metrics (v1.2). v1.3.1: monospace detection now reads the binary's `post.isFixedPitch` flag, not just the family name. v1.4: emits one block per (family, weight, style) tuple |
| `--gdpr-report` | off | Emit `GDPR.md` + `gdpr.json` listing every third-party font request with self-host remediation (v1.4) |
| `--emit <list>` | — | Framework configs: `next`, `tailwind`, `vite`, `tokens` (v1.4), `css` (default) |
| `--force` | off | Bypass the fail-fast check that blocks all-commercial sites |
| `--whitelist <spec>` (subset) | — | Extra codepoints to always include, on top of the DOM walk. CSS `unicode-range` syntax: `U+00A0,U+20AC,U+0020-007F` (v1.3) |
| `--split-ranges[=<buckets>]` (subset) | off | Emit one woff2 per Google Fonts language bucket (`latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, `greek-ext`, `vietnamese`) and a chained `fonts.subset.css` (v1.3) |

Examples:

```bash
fontfetch https://shinobidata.com
fontfetch https://linear.app ./public/fonts
fontfetch https://vercel.com /tmp/scratch
fontfetch https://some-spa.com --headless
fontfetch https://acme.com --pages=5
fontfetch https://shinobidata.com --formats=woff2
fontfetch https://stripe.com --headless --fallback --emit next
fontfetch inspect ./downloaded-fonts/example.com/files/google/Inter-Variable.woff2
fontfetch subset https://stripe.com
fontfetch subset https://stripe.com --whitelist=U+00A0,U+20AC
fontfetch subset https://stripe.com --split-ranges
```

### What's new in v1.4

**Eight features in one minor.** Four close out the engine work (competitor-gap closeouts from the [2026-05-28 research](./docs/research-competitor-feature-gaps-2026-05-28.md)) and four ship as distribution channels so fontfetch shows up where users already work.

#### Distribution channels

- **`@fontfetch/registry`** — new typed npm package. Consumes the community pairings registry with full autocomplete:
  ```bash
  npm install @fontfetch/registry
  ```
  ```ts
  import { findByFamily, freeAlternativesFor } from '@fontfetch/registry';
  freeAlternativesFor('Söhne');  // ['Inter', 'Manrope', 'Outfit']
  ```
- **`fontfetch-action` GitHub Action** ([`extensions/github-action/`](./extensions/github-action)). PR comments on font drift; non-zero exit when budgets bust or commercial faces sneak in.
- **Raycast extension** ([`extensions/raycast/`](./extensions/raycast)). Three commands: extract fonts from a URL (CSS to clipboard), audit a URL (HUD verdict), search the pairings registry.
- **Homebrew Formula** ([`extensions/homebrew/`](./extensions/homebrew)). Source-of-truth tap Formula ready to publish to `homebrew-fontfetch` when warranted.
- **`--gdpr-report` flag.** Emits `GDPR.md` + `gdpr.json` listing every third-party font request with self-host remediation. Post-LG München I 20 O 1393/21 (2022) German court ruling on Google Fonts CDN.
- **Variable-font collapse hint.** When a family ships both a variable binary and ≥ 2 static weight files, fontfetch surfaces a one-liner with the byte saving.

#### Engine — release-gate capabilities

- **`fontfetch diff <urlA> <urlB>` — staging-vs-prod font drift.** Runs `pull()` on both URLs, prints added / removed / shared families with byte and commercial delta. `--json` for CI:
  ```bash
  fontfetch diff https://staging.acme.com https://acme.com
  fontfetch diff https://staging.acme.com https://acme.com --json
  ```
- **`fontfetch audit <url>` — CI release gate.** Non-zero exit on configured rule violations. Combine `--max-kb`, `--per-family-kb`, `--no-commercial`. Pairs with `--json` for downstream tools:
  ```bash
  fontfetch audit https://acme.com --max-kb 200 --no-commercial
  fontfetch audit https://acme.com --per-family-kb Inter:50,Geist:30 --json
  ```
- **`fontfetch budget <url> --max-kb N` — bundle-size budget shortcut.** Same engine as `audit` with only the size dimension wired. Drop-in for size-limit / Lighthouse-CI workflows.
- **`--emit tokens` — W3C / DTCG design tokens.** New emitter alongside `next` / `tailwind` / `vite`. Writes `fonts.tokens.json` with W3C Design Tokens Community Group ([tr.designtokens.org/format/](https://tr.designtokens.org/format/)) entries for every family + weight, plus a Tailwind-aligned size + line-height ladder. Drop into Style Dictionary, Tokens Studio for Figma, or Specify:
  ```bash
  fontfetch https://vercel.com --emit tokens
  ```
- **`CONSISTENCY.md` cross-page report.** When `--pages > 1`, fontfetch writes a per-pull report of shared-vs-divergent families across crawled pages. *"Homepage uses Inter; `/blog` uses Tiempos"* — the report names the divergence per page. No competitor does this.
- **Per-weight Capsize fallback metrics.** `--fallback` now emits one `<Family> Fallback` block per (family, weight, style) tuple, each with matching `font-weight` and `font-style` declarations. Beats `fontaine` on their core feature ([fontaine #53](https://github.com/unjs/fontaine/issues/53), open 3+ years).
- **`provenance.json` machine-readable license + provenance.** Stable v1.0 schema. Shipped per pull alongside `LICENSE_REVIEW.md`. Consumed by `fontfetch audit`, the upcoming `fontfetch-action` GitHub Action, and external CI tools.

No new runtime dependencies; bundle size unchanged at ~2.2 MB.

### What's new in v1.3

Three additions that round out the subsetting pipeline. After v1.3, fontfetch takes a URL → folder, splits per Google Fonts language bucket, and runs entirely on Node — no Python required:

- **`--formats=woff2` modern-only emit.** Restricts the kept faces and downloaded files to a chosen format allowlist (one or more of `woff2`, `woff`, `ttf`, `otf`, `eot`). Addresses a long-standing community ask for modern-format-only output. Halves the typical bundle size on a modern-browser-only site:
  ```bash
  fontfetch https://shinobidata.com --formats=woff2
  ```
- **`fontfetch subset --whitelist=U+00A0,U+20AC` — extra codepoints to always keep.** Same syntax as a CSS `unicode-range`. Pairs with the existing DOM-scrape pipeline so glyphs not rendered on page load (currency variants, breaking-space, icon-font glyphs injected by JS) stay alive in the subset. The `0x` shorthand is also accepted:
  ```bash
  fontfetch subset https://stripe.com --whitelist=U+00A0,U+20AC,U+0020-007F
  ```
- **`fontfetch subset --split-ranges` — Google-Fonts-style per-language emit.** For every downloaded font, fontfetch intersects its character set against the canonical Google Fonts buckets (`latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, `greek-ext`, `vietnamese`) and emits one woff2 per bucket plus a chained `fonts.subset.css` with `unicode-range:` declarations. The output is interchangeable with Google Fonts' own `css2` payload for a multi-script family. Browsers lazy-load only the buckets they need at runtime:
  ```bash
  fontfetch subset https://stripe.com --split-ranges
  fontfetch subset https://stripe.com --split-ranges=latin,latin-ext,vietnamese
  ```

No new runtime dependencies. The split flow reuses the existing `fontkit` runtime dep (already used by `inspect` and `--fallback`) and the `subset-font` peer dep.

### What's new in v1.2.1 — discovery + empty-state quick wins

Four small additions targeting the most common confusing outcomes of the v1.2 release:

- **Variable fonts now announce themselves.** After downloads complete fontfetch inspects every binary on disk; if any expose variation axes you get a one-line notice (`ℹ One variable font detected: Saans (wght 300..900, ital 0..10). All weights and italic styles live in this single binary.`) so `1 unique file(s)` stops reading as "the rest are missing."
- **Next.js `next/font` subset siblings.** Any URL matching `_next/static/media/<hash>-s.<letter>.<ext>` triggers an alphabet-wide HEAD probe in parallel and adds the responders to the bundle. Captures the full multi-language family even when the visited page only loaded one unicode subset.
- **`--pages <N>` multi-page crawl.** Visits up to `N-1` same-origin internal links from the entry HTML (deduped, hash-stripped, asset-extension-skipped) and merges every page's `@font-face` rules. Solves the "homepage loads Inter but `/blog` uses Tiempos" problem. Capped at 50; default 1.
- **Focused empty-state output.** Zero `@font-face` declarations now prints a 3-line "this is usually fixable" frame with concrete next-step flags, instead of a single buried sentence.

```bash
fontfetch https://acme.com --pages=5
```

### What's new in v1.2 — inspect, subset, zero-CLS fallback

Three subcommands shipped together so the whole pipeline becomes *extract → inspect → ship*:

- **`fontfetch inspect <file>`** — terminal-native font inspector. Reads any woff2/woff/ttf/otf and prints a column-aligned report: glyph count, format, units-per-em, variation axes, OpenType features, vendor / designer / copyright, and an SIL OFL detection that flags the Reserved Font Name (RFN) clause when present. Wakamai Fondue, but in your terminal.

- **`--fallback`** — for every extracted family, fontfetch now reads the binary's metrics via [capsize](https://github.com/seek-oss/capsize) and emits a `<Family> Fallback` `@font-face` block with `size-adjust` / `ascent-override` / `descent-override` / `line-gap-override` matched to a system fallback (Arial / Times New Roman / Courier New, picked by family-name heuristic). The emitted `fonts.css` chains `'<Family>', '<Family> Fallback', <generic>` so the browser swaps between visually identical boxes during the font load. Solves the same CLS problem `next/font` and `fontaine` solve — but framework-agnostic, plain CSS only.

- **`fontfetch subset <url>`** — runs the full extraction, then loads the page in headless Chromium, walks every visible text node plus `::before`/`::after` `content`, and subsets each font down to the unique codepoints actually rendered. Uses `subset-font` (a WASM wrapper around harfbuzzjs) so it runs pure-Node — no Python `fonttools` install required, unlike `glyphhanger`. Outputs siblings as `<original>.subset.woff2`. Common case: 30-90% smaller webfonts in one command.

Also bundled in 1.2: every emitted `@font-face` now defaults to `font-display: swap`, and `fonts.css` carries a copy-pasteable `<link rel="preload" as="font" type="font/woff2" crossorigin>` hint header so you don't have to remember the `crossorigin` attribute (the most common preload foot-gun).

`subset` needs `subset-font` (optional peer dependency, the harfbuzzjs WASM wrapper):

```bash
npm install subset-font
```

### License review (v0.4)

Every pull writes `LICENSE_REVIEW.md` alongside the rest of the per-site output. Each face is classified by a URL-signature heuristic (Adobe Typekit, Monotype, Hoefler, Type Network, etc.) plus a family-name fallback against a curated SIL OFL / Google Fonts catalog snapshot.

```
→ License review: 8 open / 2 commercial / 3 unknown
```

**Fail-fast.** When every detected font is served from a known commercial-foundry CDN, fontfetch aborts before downloading and emits only `LICENSE_REVIEW.md`. Pass `--force` to download anyway (e.g. for a local mockup of a site whose fonts you've licensed).

```bash
fontfetch https://commercial-foundry-site.com           # aborts, writes LICENSE_REVIEW.md
fontfetch https://commercial-foundry-site.com --force   # downloads anyway
```

Not legal advice. The classifier is heuristic-only and conservative on purpose — verify before shipping.

### Framework emitters (v0.3)

Pass `--emit <target,target,...>` to generate framework-ready config files alongside the default `fonts.css`.

```bash
fontfetch https://vercel.com --emit next,tailwind
```

Targets:

| Target | Emits | Use it for |
|---|---|---|
| `next` | `next.fonts.ts` | Drop-in `next/font/local` config — one `localFont` call per family with all weights, plus a CSS variable |
| `tailwind` | `tailwind.fonts.ts` | `fontFamily` snippet for `tailwind.config.ts` — `sans` / `serif` / `mono` heuristic + per-family aliases. Pairs with `next` for CSS variables |
| `vite` | `vite.fonts.md` | Copy-paste integration guide. Vite needs no plugin — the default `fonts.css` is already a drop-in stylesheet |
| `css` | (default) | Explicit no-op |

Output ends up alongside the rest of the per-site bundle:

```
downloaded-fonts/vercel-com/
├── files/
├── fonts.css
├── fonts.json
├── README.md
├── next.fonts.ts          ← --emit next
└── tailwind.fonts.ts      ← --emit tailwind
```

### Headless mode (v0.2)

By default fontfetch is **static** — it fetches the HTML, reads every linked stylesheet and inline `<style>`, and parses `@font-face` rules. That covers ~90% of real-world sites and is fast.

For SPAs that load fonts at runtime, sites that inject `@font-face` blocks via JavaScript after hydration, or pages behind a Cloudflare challenge, pass `--headless`. fontfetch will launch a headless Chromium via Playwright, wait for `document.fonts.ready`, and dump every `@font-face` rule it can see — merged with the static results.

Install Playwright + Chromium once:

```bash
npm install playwright
npx playwright install chromium
```

Then:

```bash
fontfetch https://example.com --headless
```

Playwright is an **optional peer dependency** — install it only if you need this mode. The static path runs with zero runtime dependencies.

## How it works

1. Fetches the page HTML
2. Pulls every `<link rel="stylesheet">` and inline `<style>` block
3. Parses every `@font-face` block: family, weight, style, unicode-range, src
4. Also grabs `<link rel="preload" as="font">` references
5. Downloads every unique font file
6. Rewrites the `@font-face` blocks with local `./files/...` URLs
7. Emits `fonts.css`, `fonts.json`, and a `README.md`

No browser launched, no dependencies pulled at install time outside of TypeScript build tooling. The whole CLI is one small ESM bundle.

## How it compares

| Tool | Any URL | JS-rendered fonts | License classify | Framework emit | Inspect | Subset | Per-language split | Modern-only | Zero-CLS fallback | CI release-gate | Cross-page |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `google-webfonts-helper` | Google only | n/a | n/a | ✗ | ✗ | ✗ | ✓ (Google catalog only) | ✓ | ✗ | ✗ | ✗ |
| `webfont-dl` | needs CSS URL | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `glyphhanger` | ✓ (Puppeteer) | ✓ | ✗ | ✗ | ✗ | ✓ (Python `fonttools`) | partial (unicode-range computed) | partial | ✗ | ✗ | ✗ |
| `fontaine` | n/a | n/a | n/a | partial | ✗ | ✗ | ✗ | n/a | ✓ family-wide (Nuxt/Vite only) | ✗ | ✗ |
| `fontkit` | library, not a CLI | n/a | partial | ✗ | partial (library) | ✗ | ✗ | n/a | ✗ | ✗ | ✗ |
| Chrome extensions | ✓ (manual) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **`fontfetch`** | ✓ | ✓ | ✓ | ✓ next/tailwind/vite/**tokens** (v1.4) | ✓ | ✓ (Node, no Python) | ✓ Google Fonts buckets (v1.3) | ✓ `--formats=woff2` (v1.3) | ✓ **per-weight**, framework-agnostic (v1.4) | ✓ `audit` / `budget` / `diff` / `--json` (v1.4) | ✓ `CONSISTENCY.md` via `--pages` (v1.4) |

*"CI release-gate"* means non-zero exit codes on rule violations + `--json` output for downstream tooling. *"Cross-page"* means crawling multiple pages from a single entry URL and surfacing typography drift between them. Both are categories with zero competitors today.

## Roadmap

- [x] **v0.1** — Static `@font-face` extraction, ready-to-use CSS, manifest, README
- [x] **v0.1.1** — [Community font-pairing registry](./docs/roadmap.md#v011--community-font-pairing-registry): share what fonts your favorite sites use, with free OFL alternatives
- [x] **v0.2** — `--headless` flag: Playwright mode for JS-loaded fonts (Adobe Typekit, SPAs, Cloudflare-protected sites)
- [x] **v0.2.2** — Referer-aware font downloads (unblocks foundry CDNs that 403 without a Referer)
- [x] **v0.3** — Framework emitters: `--emit next` / `tailwind` / `vite`
- [x] **v0.4** — License heuristic + `LICENSE_REVIEW.md` + fail-fast on all-commercial sites (`--force` to bypass)
- [x] **v0.6** — Provenance grouping: output split into `google/` / `adobe-typekit/` / `commercial/` / `open-cdn/` / `self-hosted/`
- [x] **v1.0** — [pnpm-workspaces monorepo restructure](./docs/roadmap.md#v10--monorepo-restructure--shipped): `@fontfetch/core` + the CLI, with `apps/` slots reserved for the webapp and headless worker
- [x] **v1.2** — [Inspect + subset + fallback release](./docs/roadmap.md#v12--flagship-inspect--subset--fallback-release--shipped-2026-05-28): `fontfetch inspect` (terminal Wakamai Fondue), `--fallback` (zero-CLS `@font-face` blocks via capsize), `fontfetch subset` (Playwright DOM scrape + harfbuzzjs subset, no Python). Plus `font-display: swap` default and preload-hint header on every emitted `fonts.css`.
- [x] **v1.2.1** — [Discovery + empty-state quick wins](./docs/roadmap.md#v121--discovery--empty-state-quick-wins--shipped): variable-font hint after pull, Next.js subset sibling probe, `--pages <N>` multi-page crawl, focused 0-declaration output.
- [x] **v1.3** — [Modern emit + whitelist + per-language split](./docs/roadmap.md#v13--shipped-2026-05-28): `--formats=woff2` modern-only emit, `subset --whitelist=U+00A0,…` extra codepoints, `subset --split-ranges` Google-Fonts-style per-language woff2 + chained `fonts.subset.css` with `unicode-range:` declarations.
- [x] **v1.3.1** — [Signal quality](./docs/roadmap.md#v131--signal-quality--shipped-2026-05-29): `--fallback` reads `post.isFixedPitch` (catches Operator / PragmataPro / Berkeley Mono); license classifier cross-references the binary's `name` table (ids 13 + 14); `LICENSE_REVIEW.md` calls out OFL Reserved Font Name families.
- [x] **v1.4** — [CI release-gate + distribution channels](./docs/roadmap.md#v14--distribution-surface--competitor-gap-closeouts-v140--shipped-2026-05-29--distribution-channels-shipped-2026-05-29-in-v14x-rolled-in): engine = `fontfetch diff` / `audit` / `budget` + `--emit tokens` + `--gdpr-report` + per-weight Capsize fallback + cross-page `CONSISTENCY.md` + machine-readable `provenance.json` + variable-font collapse hint. Channels = [`@fontfetch/registry`](./packages/registry) typed npm package + [`fontfetch-action`](./extensions/github-action) GitHub Action + [Raycast extension](./extensions/raycast) + [Homebrew tap](./extensions/homebrew).
- [ ] **v0.5** — [Hosted webapp at `fontfetch.dev`](./docs/roadmap.md#v05--hosted-webapp): URL → live progress → foundry-style previews → compare + pairing

Want one of these sooner? Open an issue or vote on existing ones.

## Responsible use

Font files are software, licensed under EULAs. **fontfetch is intended for local design exploration and testing, not for shipping paid fonts you haven't licensed.** Using a font for a few hours of mockup work in a private project is different from bundling it into a production app. We don't gate the tool — we trust you to know the difference and respect foundry licenses.

For production use, the [Google Fonts](https://fonts.google.com) catalog and the [SIL Open Font License](https://openfontlicense.org/) library are designed to be self-hosted freely. Every entry in our [pairings registry](./pairings) lists free alternatives for paid fonts.

## Font pairings registry

[`pairings/`](./pairings) is a community-curated list of fonts used by real websites — with **free OFL alternatives** for every commercial font.

[**→ Submit a pairing**](https://github.com/niyamvora/fontfetch/issues/new?template=font_pairing.yml) (fill a form, drag a screenshot, done — or [ask an AI to do it for you](./pairings#b-ask-an-ai-to-do-it-for-you)).

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev loop. The codebase is small and approachable — a pnpm-workspaces monorepo with two packages (`@fontfetch/core` and the published `fontfetch` CLI), and `apps/` slots reserved for the v0.5 webapp and headless worker. `tsup` bundles core into the CLI so npm consumers see one self-contained file.

Good first issues are tagged `good first issue` on GitHub.

## License

[MIT](./LICENSE) — © Niyam Vora
