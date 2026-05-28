/**
 * Codepoint utilities for v1.3 unicode-range work.
 *
 * Two responsibilities:
 *  1. Parse CSS `unicode-range` strings (the literal `U+0020-007F, U+00A0`
 *     syntax) into a sorted array of unique integer codepoints. Used by the
 *     `--whitelist` flag and by the per-range splitter to expand the bucket
 *     definitions below.
 *  2. The canonical Google Fonts subset buckets (latin / latin-ext / cyrillic
 *     / vietnamese / …) — captured verbatim from the css2 endpoint so a
 *     fontfetch-split bundle is interchangeable with a Google-Fonts-served
 *     one. Browsers download buckets lazily based on the page's runtime
 *     glyph needs; emitting per-bucket files is what `--split-ranges`
 *     produces.
 */

/** A literal CSS unicode-range entry (either a single point or a range). */
const ENTRY_RE = /^U\+([0-9A-Fa-f]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/;
/** Same shape, but allowing `0x…` shorthand for non-CSS callers. */
const ENTRY_HEX_RE = /^0x([0-9A-Fa-f]{1,6})(?:-0x([0-9A-Fa-f]{1,6}))?$/;

/**
 * Parse a CSS `unicode-range` string into a sorted, deduplicated codepoint
 * array. Accepts the canonical CSS form (`U+0020-007F, U+00A0`) and the more
 * developer-ergonomic `0x` shorthand (`0x20-0x7F, 0xA0`). Whitespace around
 * entries is allowed; empty entries are skipped. Throws on malformed entries
 * — better to fail loudly than silently return a partial set, especially
 * when callers expect a stable subset of glyphs to ship.
 */
export function parseUnicodeRange(spec: string): number[] {
  const out = new Set<number>();
  for (const raw of spec.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = ENTRY_RE.exec(part) ?? ENTRY_HEX_RE.exec(part);
    if (!m) throw new Error(`Invalid unicode-range entry: '${part}'`);
    const start = Number.parseInt(m[1], 16);
    const end = m[2] ? Number.parseInt(m[2], 16) : start;
    if (end < start) throw new Error(`Invalid unicode-range entry (end < start): '${part}'`);
    for (let cp = start; cp <= end; cp++) out.add(cp);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Convert a codepoint list into the most compact CSS `unicode-range` string
 * that covers it. Collapses consecutive points into `U+START-END` runs.
 * Inverse of `parseUnicodeRange` for the round-trip case.
 */
export function formatUnicodeRange(codepoints: number[]): string {
  if (codepoints.length === 0) return '';
  const sorted = [...new Set(codepoints)].sort((a, b) => a - b);
  const runs: string[] = [];
  let runStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const cp = sorted[i];
    if (cp === prev + 1) {
      prev = cp;
      continue;
    }
    runs.push(formatRun(runStart, prev));
    runStart = cp;
    prev = cp;
  }
  runs.push(formatRun(runStart, prev));
  return runs.join(', ');
}

function formatRun(start: number, end: number): string {
  const fmt = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
  return start === end ? `U+${fmt(start)}` : `U+${fmt(start)}-${fmt(end)}`;
}

/**
 * Canonical Google Fonts subset buckets. Names and `unicodeRange` strings
 * mirror what the css2 endpoint serves for a typical Latin family (Inter,
 * Roboto, Open Sans). Add a bucket here only if Google Fonts adds one
 * upstream — keeping parity is the point.
 */
export interface UnicodeRangeBucket {
  name: string;
  unicodeRange: string;
}

export const GOOGLE_FONTS_RANGES: readonly UnicodeRangeBucket[] = [
  {
    name: 'latin',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    name: 'latin-ext',
    unicodeRange:
      'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
  {
    name: 'cyrillic',
    unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  },
  {
    name: 'cyrillic-ext',
    unicodeRange:
      'U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  },
  { name: 'greek', unicodeRange: 'U+0370-03FF' },
  { name: 'greek-ext', unicodeRange: 'U+1F00-1FFF' },
  {
    name: 'vietnamese',
    unicodeRange:
      'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
  },
] as const;

/** Expanded codepoint set for one bucket — handy for set-intersection logic. */
export function expandBucket(bucket: UnicodeRangeBucket): number[] {
  return parseUnicodeRange(bucket.unicodeRange);
}

/** Minimum overlap (in codepoints) between a source font and a bucket before we bother emitting a subset file for that bucket. */
export const MIN_GLYPHS_PER_BUCKET = 5;
