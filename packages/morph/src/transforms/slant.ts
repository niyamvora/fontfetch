/**
 * Slant — horizontal shear, the honest faux-italic. Lossless: x is displaced by
 * `tan(angle) * y`, leaving y untouched, so verticals lean but heights hold.
 * This is a synthetic oblique, not a true italic (no glyph redesign) — the CLI
 * surfaces that caveat to the user.
 */
import { mapCommandPoints } from '../geometry.js';
import type { GlyphTransform } from '../types.js';

/** @param degrees Slant angle; positive leans right. */
export function slantTransform(degrees: number): GlyphTransform {
  const t = Math.tan((degrees * Math.PI) / 180);
  return (commands) => commands.map((cmd) => mapCommandPoints(cmd, (p) => ({ x: p.x + t * p.y, y: p.y })));
}
