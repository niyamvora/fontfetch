/**
 * Width — horizontal scale about the glyph origin. Lossless: a pure matrix
 * transform on every coordinate. The caller also scales each glyph's advance
 * width by the same factor (see morph.ts) so spacing tracks the new shapes.
 */
import { mapCommandPoints } from '../geometry.js';
import type { GlyphTransform } from '../types.js';

/** @param scale Horizontal scale factor, e.g. 1.1 for 110%. */
export function widthTransform(scale: number): GlyphTransform {
  return (commands) => commands.map((cmd) => mapCommandPoints(cmd, (p) => ({ x: p.x * scale, y: p.y })));
}
