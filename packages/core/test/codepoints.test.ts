import { describe, expect, it } from 'vitest';
import {
  parseUnicodeRange,
  formatUnicodeRange,
  GOOGLE_FONTS_RANGES,
  expandBucket,
} from '../src/formats/codepoints.js';

describe('parseUnicodeRange', () => {
  it('parses a single codepoint', () => {
    expect(parseUnicodeRange('U+00A0')).toEqual([0xa0]);
  });

  it('parses a range', () => {
    expect(parseUnicodeRange('U+0020-0022')).toEqual([0x20, 0x21, 0x22]);
  });

  it('parses a mix of single + ranges, sorted + deduped', () => {
    expect(parseUnicodeRange('U+0030-0032, U+0020, U+0031, U+0040')).toEqual([
      0x20, 0x30, 0x31, 0x32, 0x40,
    ]);
  });

  it('accepts the 0x shorthand', () => {
    expect(parseUnicodeRange('0x00A0,0x20AC')).toEqual([0xa0, 0x20ac]);
    expect(parseUnicodeRange('0x20-0x22')).toEqual([0x20, 0x21, 0x22]);
  });

  it('tolerates surrounding whitespace and empty entries', () => {
    expect(parseUnicodeRange('  U+0020 ,  , U+00A0 ')).toEqual([0x20, 0xa0]);
  });

  it('throws on a malformed entry', () => {
    expect(() => parseUnicodeRange('U+ZZZZ')).toThrow(/Invalid unicode-range/);
    expect(() => parseUnicodeRange('U+0020-001F')).toThrow(/end < start/);
    expect(() => parseUnicodeRange('not-a-codepoint')).toThrow(/Invalid unicode-range/);
  });
});

describe('formatUnicodeRange', () => {
  it('collapses consecutive runs into U+START-END', () => {
    expect(formatUnicodeRange([0x20, 0x21, 0x22, 0x40])).toBe('U+0020-0022, U+0040');
  });

  it('keeps singletons as U+POINT', () => {
    expect(formatUnicodeRange([0xa0, 0x20ac])).toBe('U+00A0, U+20AC');
  });

  it('dedupes + sorts on the way in', () => {
    expect(formatUnicodeRange([0x40, 0x20, 0x21, 0x20, 0x22])).toBe('U+0020-0022, U+0040');
  });

  it('round-trips with parseUnicodeRange', () => {
    const spec = 'U+0020-007F, U+00A0, U+20AC';
    const cps = parseUnicodeRange(spec);
    const back = formatUnicodeRange(cps);
    expect(parseUnicodeRange(back)).toEqual(cps);
  });

  it('returns an empty string for empty input', () => {
    expect(formatUnicodeRange([])).toBe('');
  });
});

describe('GOOGLE_FONTS_RANGES', () => {
  it('exposes the canonical seven buckets', () => {
    const names = GOOGLE_FONTS_RANGES.map((b) => b.name);
    expect(names).toEqual([
      'latin',
      'latin-ext',
      'cyrillic',
      'cyrillic-ext',
      'greek',
      'greek-ext',
      'vietnamese',
    ]);
  });

  it('every bucket parses cleanly via parseUnicodeRange', () => {
    for (const b of GOOGLE_FONTS_RANGES) {
      expect(() => parseUnicodeRange(b.unicodeRange)).not.toThrow();
      expect(expandBucket(b).length).toBeGreaterThan(0);
    }
  });

  it('latin bucket covers basic ASCII', () => {
    const latin = new Set(expandBucket(GOOGLE_FONTS_RANGES[0]));
    for (let cp = 0x20; cp < 0x7f; cp++) {
      expect(latin.has(cp)).toBe(true);
    }
  });

  it('cyrillic bucket covers U+0400 block', () => {
    const cyr = new Set(expandBucket(GOOGLE_FONTS_RANGES[2]));
    expect(cyr.has(0x0410)).toBe(true); // А
    expect(cyr.has(0x044f)).toBe(true); // я
  });

  it('vietnamese bucket includes the dong sign and combining tones', () => {
    const viet = new Set(expandBucket(GOOGLE_FONTS_RANGES[6]));
    expect(viet.has(0x20ab)).toBe(true); // ₫
    expect(viet.has(0x0301)).toBe(true); // ́ combining acute
  });
});
