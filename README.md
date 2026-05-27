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

Or install globally:

```bash
npm install -g fontfetch
fontfetch <url>
```

Requires Node 18+.

## Usage

```bash
fontfetch <url> [outDir] [--headless] [--fallback] [--emit ...] [--force]
fontfetch inspect <font-file>
fontfetch subset <url> [outDir]
```

| Arg / Flag | Default | Notes |
|---|---|---|
| `<url>` | — | Page to download fonts from (use the page where the font is actually rendered) |
| `[outDir]` | `./downloaded-fonts` | Per-site subfolder is created inside this |
| `--headless` | off | Launch Playwright/Chromium to also catch JS-loaded fonts |
| `--fallback` | off | Emit a CLS-killing `<Family> Fallback` `@font-face` per family, with `size-adjust` / `ascent-override` / `descent-override` / `line-gap-override` matched via capsize metrics (v1.2) |
| `--emit <list>` | — | Framework configs: `next`, `tailwind`, `vite`, `css` (default) |
| `--force` | off | Bypass the fail-fast check that blocks all-commercial sites |

Examples:

```bash
fontfetch https://shinobidata.com
fontfetch https://linear.app ./public/fonts
fontfetch https://vercel.com /tmp/scratch
fontfetch https://some-spa.com --headless
fontfetch https://stripe.com --headless --fallback --emit next
fontfetch inspect ./downloaded-fonts/example.com/files/google/Inter-Variable.woff2
fontfetch subset https://stripe.com
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

| Tool | Any URL | JS-rendered fonts | License classify | Framework emit | Inspect | Subset | Zero-CLS fallback |
|---|---|---|---|---|---|---|---|
| `google-webfonts-helper` | Google only | n/a | n/a | ✗ | ✗ | ✗ | ✗ |
| `webfont-dl` | needs CSS URL | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `glyphhanger` | ✓ (Puppeteer) | ✓ | ✗ | ✗ | ✗ | ✓ (Python `fonttools`) | ✗ |
| `fontaine` | n/a | n/a | n/a | partial | ✗ | ✗ | ✓ (Nuxt/Vite only) |
| `fontkit` | library, not a CLI | n/a | partial | ✗ | partial (library) | ✗ | ✗ |
| Chrome extensions | ✓ (manual) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **`fontfetch`** | ✓ | ✓ | ✓ | ✓ next/tailwind/vite | ✓ | ✓ (Node, no Python) | ✓ framework-agnostic |

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
