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

### v0.2.2 — Referer-aware font downloads

`fetchBuffer` in [src/utils.ts](../src/utils.ts) currently sends only `User-Agent`. Many CDNs (and some self-hosted setups) require a `Referer` header matching the page that loaded the CSS — without it, requests 403 even when nothing else is wrong. v0.2.2 threads the originating page URL through `pull` → `fetchBuffer` so every font request carries the correct `Referer` (mirroring what we already do for stylesheet fetches in [src/pull.ts:28](../src/pull.ts#L28)).

Out of scope: bypassing signed-URL or session-bound protection used by commercial foundries — that's a different problem, addressed proactively in v0.4.

## v0.3 — framework emitters

`--emit <target>` where target is one of:

- `next` — generates a `lib/fonts.ts` file with `next/font/local` calls + CSS variables wired to `localFont({ src: [...] })`
- `tailwind` — generates a `fontFamily` block ready to paste into `tailwind.config.ts`
- `vite` — generates a CSS module import suggestion + global font registration
- `astro` — same idea
- `css` — current behavior (default)

Multiple emitters allowed: `--emit next,tailwind`.

## v0.4 — license heuristic

Generates `LICENSE_REVIEW.md` per site. For each family, classify:

- ✅ **Open / self-hostable** — matched against Google Fonts catalog snapshot, or SIL OFL keywords in URL
- ⚠️ **Commercial foundry** — known CDNs (`use.typekit.net`, `fonts.adobe.com`, `fast.fonts.net`, `cloud.typenetwork.com`, Klim's CloudFront, etc.)
- ❓ **Unknown** — flag for manual review

No legal advice. Just signal so people don't accidentally ship Helvetica Now.

**Fail-fast on commercial CDNs.** When every detected font URL points at a known commercial-foundry CDN, warn up-front ("This site serves fonts from Klim Type Foundry's CloudFront — files are signed/session-bound and will 403. Skipping download; see LICENSE_REVIEW.md for legitimate sources.") instead of attempting 17 doomed requests. Catches the failure mode hit when running fontfetch against e.g. [klim.co.nz/fonts/soehne](https://klim.co.nz/fonts/soehne/).

## v0.5 — preview gallery

Auto-generate `preview.html` in the output folder. Renders each family × weight × style with a pangram, size scale (12/16/24/48/96 px), and a paragraph block. Opens in a browser — instant visual sanity check.

## v0.6 — provenance grouping

Output split:

```
downloaded-fonts/example.com/
├── google/
├── adobe-typekit/
├── cdn/
└── self-hosted/
```

Makes the "free vs licensed" split visible at a glance.

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
