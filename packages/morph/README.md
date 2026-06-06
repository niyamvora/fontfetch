# @fontfetch/morph

Prototyping-grade parametric font morphing for [fontfetch](https://github.com/niyamvora/fontfetch). Take any font outline, drag four sliders — **round**, **width**, **slant**, **weight** — and write a real binary back out.

Built for **pre-commission ideation**: a typography sketchbook for showing a client "what your wordmark could look like with a slightly rounder, wider, slanted custom face" — *before* commissioning a real type designer. It is **not** a production type-design tool, and it does not replace one.

> **Status:** shipped in v1.5 — engine, the `fontfetch morph` CLI surface, the commercial-font licensing guardrails, and WOFF2 input/output are all live. This package is `private` (not published standalone); it's **bundled into the published `fontfetch` CLI**, so end users install nothing extra. Import it directly only inside the workspace.

## API

```ts
import { morph } from '@fontfetch/morph';
import { readFileSync, writeFileSync } from 'node:fs';

const { font, applied, warnings } = morph(readFileSync('Inter.ttf'), {
  round: 20,   // 0–100  (% corner radius)
  width: 108,  // 80–120 (% horizontal scale)
  slant: 6,    // 0–15   (degrees, faux italic)
  weight: 8,   // −15…+15 (% stroke, experimental on static fonts)
});

writeFileSync('Inter-Prototype.ttf', font);
warnings.forEach((w) => console.warn(w));
```

`morph()` clamps every slider to its supported range, applies the transforms to all glyphs, and always returns a usable binary plus any `warnings` (clamping, experimental weight).

### The four transforms

| Slider | How it works | Fidelity |
|---|---|---|
| **width** | Horizontal scale matrix; advance widths scale to match | Lossless |
| **slant** | Horizontal shear (`x += tan(θ)·y`) | Lossless — an honest faux-oblique, not a true italic |
| **round** | Fillets straight-line corners with quadratic curves | Corners on curves pass through untouched (first cut) |
| **weight** | Winding-aware outline offset along vertex normals | **Experimental** on static fonts; clamped to ±15%. A variable font's `wght` axis is the lossless path |

You can also import the individual transforms (`widthTransform`, `slantTransform`, `roundTransform`, `weightTransform`) and the I/O helpers (`loadFont`, `saveFont`, `readGlyphCommands`, `writeGlyphCommands`).

## Input / output

Accepts any TrueType / OpenType / WOFF binary [opentype.js](https://opentype.js.org/) can parse. **WOFF2 is handled too** — it's decompressed on input and recompressed on output via `wawoff2` (`isWoff2` / `decompressWoff2` / `compressWoff2`). Output is a TrueType-flavoured OpenType binary, universally loadable.

## Licensing

The morph engine is license-agnostic, but morphing a font you do not have the right to modify is on you. Most commercial EULAs forbid modification even for mockups; OFL fonts allow it but may require a rename (the Reserved Font Name clause). The `fontfetch morph` CLI enforces this: OFL inputs get the clean path (Reserved Font Names are renamed automatically), while commercial / unknown inputs are warned about, watermarked in the binary's `name` table, renamed, and written as a `MOCKUP_` bundle with a disclaimer. Set `FONTFETCH_MORPH_POSTURE=ofl-only` to refuse anything not self-declared OFL. Calling `morph()` directly skips that gate, so **only morph fonts you are licensed to modify.**

MIT © Niyam Vora
