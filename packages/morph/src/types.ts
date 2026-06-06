/**
 * Public types for `@fontfetch/morph`.
 *
 * The morph engine operates on glyph outlines expressed as a flat list of
 * drawing commands — the same shape opentype.js uses for `Path.commands`, so
 * the two interoperate without translation.
 */

/** A single outline drawing command. Coordinates are in font units. */
export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' };

/**
 * The four parametric sliders. All are optional; an omitted slider is a no-op.
 * Values are the user-facing units described in the v1.5 roadmap, not radians
 * or ratios — clamping to the documented range happens inside {@link morph}.
 */
export interface MorphOptions {
  /** Corner radius, 0–100 (%). 0 leaves corners untouched. */
  round?: number;
  /** Horizontal scale, 80–120 (%). 100 is unchanged. */
  width?: number;
  /** Slant angle, 0–15 (degrees). Positive leans right (faux italic). */
  slant?: number;
  /** Stroke weight delta, −20…+20 (%). Static-font path is experimental. */
  weight?: number;
  /** Rename the font family in the output binary (OFL RFN / mockup identity). */
  rename?: string;
  /** Embed this watermark string into the output's name table (commercial inputs). */
  watermark?: string;
}

/** The four slider values actually applied, after clamping. */
export interface AppliedMorph {
  round: number;
  width: number;
  slant: number;
  weight: number;
}

/** Result of a {@link morph} run. */
export interface MorphResult {
  /** The morphed font as a TrueType-flavoured OpenType binary. */
  font: Uint8Array;
  /** The clamped slider values that were applied. */
  applied: AppliedMorph;
  /** The family name written to the output, when a rename was applied. */
  renamedTo?: string;
  /** True when a watermark was embedded in the output's name table. */
  watermarked: boolean;
  /** Non-fatal advisories (e.g. experimental static-weight, clamped input). */
  warnings: string[];
}

/** A transform that maps one command list to a new one. Pure; never mutates. */
export type GlyphTransform = (commands: PathCommand[], unitsPerEm: number) => PathCommand[];
