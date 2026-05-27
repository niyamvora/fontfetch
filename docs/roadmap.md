# Roadmap

Versions are signals of scope, not promises of timing.

## v0.1 — shipping ✓

Static `@font-face` extraction. Per-site folder with `files/`, `fonts.css`, `fonts.json`, `README.md`.

## v0.2 — Playwright mode

`--headless` flag. Spawns a headless Chromium, loads the page, awaits `document.fonts.ready`, dumps fonts from `document.fonts.values()` and the network log.

Catches:
- Adobe Typekit (`use.typekit.net`)
- Cloudflare-protected sites
- SPAs that load fonts after hydration
- Fonts injected by JS at runtime

Playwright stays an `optionalDependencies` install — don't make every user download 200 MB of Chromium for the static path.

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
- ⚠️ **Commercial foundry** — known CDNs (`use.typekit.net`, `fonts.adobe.com`, `fast.fonts.net`, `cloud.typenetwork.com`)
- ❓ **Unknown** — flag for manual review

No legal advice. Just signal so people don't accidentally ship Helvetica Now.

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
