# fontfetch

> Rip every web font from any site into a project-ready folder — with CSS, manifest, and framework configs ready to drop in.

<p>
  <a href="https://www.npmjs.com/package/fontfetch"><img src="https://img.shields.io/npm/v/fontfetch.svg?style=flat-square" alt="npm" /></a>
  <a href="https://github.com/niyamvora/fontfetch/actions"><img src="https://img.shields.io/github/actions/workflow/status/niyamvora/fontfetch/ci.yml?branch=main&style=flat-square" alt="ci" /></a>
  <img src="https://img.shields.io/badge/license-MIT-black?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/node/v/fontfetch?style=flat-square" alt="node" />
</p>

```bash
npx fontfetch https://stripe.com
```

```
→ Fetching page: https://stripe.com
  3 external stylesheet(s), 0 inline <style> block(s)
→ Found 12 @font-face declaration(s), 18 unique file(s)
  ✓ SohneBreit-Buch.woff2  (32,180 bytes)
  ✓ Sohne-Buch.woff2       (28,044 bytes)
  ...
Done. 18/18 files saved to ./downloaded-fonts/stripe.com
```

That's it. Real font files, a ready-to-paste `fonts.css` with local URLs, a JSON manifest, and a README — all in one folder you can drag straight into `public/fonts/`.

---

## Why this exists

You're mocking up a design. You see a font you like on a marketing site. You want to use it locally for a few hours — not commit copyright infringement, just iterate fast on a comp.

The existing options aren't great:
- **`google-webfonts-helper`** — beautiful, but Google Fonts only
- **`webfont-dl`** — works, but you have to find the CSS URL yourself
- **Chrome extensions** — point-and-click, no automation, no project integration

**fontfetch** takes a URL. Returns a folder. That's the whole product.

## What you get

```
downloaded-fonts/
└── stripe.com/
    ├── files/                 ← raw woff2 / woff / ttf / otf
    │   ├── Sohne-Buch.woff2
    │   ├── Sohne-Halbfett.woff2
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
fontfetch <url> [outDir]
```

| Arg | Default | Notes |
|---|---|---|
| `<url>` | — | Page to scrape (use the page where the font is actually rendered) |
| `[outDir]` | `./downloaded-fonts` | Per-site subfolder is created inside this |

Examples:

```bash
fontfetch https://stripe.com
fontfetch https://linear.app ./public/fonts
fontfetch https://vercel.com /tmp/scratch
```

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

| Tool | Any URL | JS-rendered fonts | Framework config emit |
|---|---|---|---|
| `google-webfonts-helper` | Google Fonts only | n/a | ✗ |
| `webfont-dl` | Needs CSS URL | ✗ | ✗ |
| Chrome extensions | ✓ (manual) | ✓ | ✗ |
| **`fontfetch`** | ✓ | _v0.2_ | _v0.3_ |

## Roadmap

- [x] **v0.1** — Static `@font-face` extraction, ready-to-use CSS, manifest, README
- [ ] **v0.1.1** — [Community font-pairing registry](./docs/roadmap.md#v011--community-font-pairing-registry): share what fonts your favorite sites use, with free OFL alternatives
- [ ] **v0.2** — `--headless` flag: Playwright mode for JS-loaded fonts (Adobe Typekit, SPAs, Cloudflare-protected sites)
- [ ] **v0.3** — Framework emitters: `--emit next` / `tailwind` / `vite` / `astro`
- [ ] **v0.4** — License heuristic: flag Google Fonts vs commercial foundries in `LICENSE_REVIEW.md`
- [ ] **v0.5** — Visual preview gallery: auto-generate `preview.html` with pangrams per family × weight × style
- [ ] **v0.6** — Provenance grouping: split output into `google/`, `adobe-typekit/`, `self-hosted/`, `cdn/`

Want one of these sooner? Open an issue or vote on existing ones.

## Responsible use

Font files are software, licensed under EULAs. **fontfetch is for local design exploration, not for shipping commercial fonts you haven't licensed.** A few hours of mockup work in a private project is one thing; bundling Sohne in production without paying Klim is a different thing. We don't gate it — we trust you to know the difference.

For shippable fonts, look at the [Google Fonts](https://fonts.google.com) catalog or the [SIL Open Font License](https://openfontlicense.org/) library — these are designed to be self-hosted freely.

## Font pairings registry

[`pairings/`](./pairings) is a community-curated list of fonts used by real websites — with **free OFL alternatives** for every commercial font.

[**→ Submit a pairing**](https://github.com/niyamvora/fontfetch/issues/new?template=font_pairing.yml) (fill a form, drag a screenshot, done — or [ask an AI to do it for you](./pairings#b-ask-an-ai-to-do-it-for-you)).

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev loop. The codebase is small and approachable — `src/` is a handful of files, no monorepo, no build magic, just `tsup`.

Good first issues are tagged `good first issue` on GitHub.

## License

[MIT](./LICENSE) — © Niyam Vora
