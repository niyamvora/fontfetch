/**
 * The public entry point — orchestrates Steps 2 and 3 of the v1.5 build:
 * load → apply the four transforms to every glyph → save.
 *
 * Sliders are clamped to their supported ranges before anything runs; any
 * clamp (and the experimental static-weight path) is reported back in
 * `warnings` rather than thrown, so a caller always gets a usable binary.
 */
import { loadFont, saveFont, readGlyphCommands, writeGlyphCommands } from './io.js';
import { widthTransform, slantTransform, roundTransform, weightTransform } from './transforms/index.js';
import { renameFamily, applyWatermark } from './naming.js';
import type { AppliedMorph, GlyphTransform, MorphOptions, MorphResult } from './types.js';

const RANGES = {
  round: { min: 0, max: 100, def: 0 },
  width: { min: 80, max: 120, def: 100 },
  slant: { min: 0, max: 15, def: 0 },
  // Static-font weight is experimental and clamped tighter than the ±20 the
  // CLI surface advertises; the lossless ±20 path requires a variable font.
  weight: { min: -15, max: 15, def: 0 },
} as const;

/**
 * Morph a font binary with the four parametric sliders.
 *
 * @param data  A TrueType/OpenType/WOFF binary (decompress WOFF2 first).
 * @param opts  Any subset of the four sliders; omitted sliders are no-ops.
 */
export function morph(data: Uint8Array | ArrayBuffer, opts: MorphOptions = {}): MorphResult {
  const warnings: string[] = [];
  const applied: AppliedMorph = {
    round: clamp('round', opts.round, warnings),
    width: clamp('width', opts.width, warnings),
    slant: clamp('slant', opts.slant, warnings),
    weight: clamp('weight', opts.weight, warnings),
  };
  if (applied.weight !== 0) {
    warnings.push(
      'Static-font weight is experimental: strokes are offset geometrically and may self-collide at the extremes. A variable font’s wght axis is lossless.',
    );
  }

  const font = loadFont(data);
  const unitsPerEm = font.unitsPerEm;
  const widthScale = applied.width / 100;

  // Order: round on the upright shape, then width, slant, and finally weight so
  // the stroke offset is computed against the final geometry.
  const pipeline: GlyphTransform[] = [];
  if (applied.round !== 0) pipeline.push(roundTransform(applied.round));
  if (widthScale !== 1) pipeline.push(widthTransform(widthScale));
  if (applied.slant !== 0) pipeline.push(slantTransform(applied.slant));
  if (applied.weight !== 0) pipeline.push(weightTransform(applied.weight));

  if (pipeline.length > 0) {
    for (let i = 0; i < font.glyphs.length; i++) {
      const glyph = font.glyphs.get(i);
      let commands = readGlyphCommands(glyph);
      if (commands.length > 0) {
        for (const transform of pipeline) commands = transform(commands, unitsPerEm);
        writeGlyphCommands(glyph, commands);
      }
      if (widthScale !== 1 && typeof glyph.advanceWidth === 'number') {
        glyph.advanceWidth = Math.round(glyph.advanceWidth * widthScale);
      }
    }
  }

  // Identity changes apply within the same load/save cycle so the binary is
  // serialised once. The license decision lives upstream (see posture.ts); the
  // engine just stamps what it's told.
  if (opts.rename) renameFamily(font, opts.rename);
  if (opts.watermark) applyWatermark(font, opts.watermark);

  return {
    font: saveFont(font),
    applied,
    renamedTo: opts.rename,
    watermarked: Boolean(opts.watermark),
    warnings,
  };
}

function clamp(key: keyof typeof RANGES, value: number | undefined, warnings: string[]): number {
  const { min, max, def } = RANGES[key];
  if (value === undefined || Number.isNaN(value)) return def;
  const c = Math.max(min, Math.min(max, value));
  if (c !== value) warnings.push(`${key}=${value} clamped to ${c} (supported range ${min}…${max}).`);
  return c;
}
