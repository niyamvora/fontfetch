import { describe, expect, it } from 'vitest';
import {
  FONT_FORMATS,
  isFontFormat,
  resolveFormat,
  filterFacesByFormat,
  urlMatchesFormat,
} from '../src/formats/formats.js';
import type { FontFace, FontSource } from '../src/types.js';

function source(overrides: Partial<FontSource> & { url: string }): FontSource {
  return {
    url: overrides.url,
    format: overrides.format ?? null,
    localFile: overrides.localFile,
  };
}

function face(family: string, sources: FontSource[]): FontFace {
  return { family, weight: '400', style: 'normal', display: null, unicodeRange: null, sources };
}

describe('isFontFormat', () => {
  it('recognises every canonical format', () => {
    for (const f of FONT_FORMATS) {
      expect(isFontFormat(f)).toBe(true);
    }
  });
  it('rejects aliases (truetype, opentype) — they should be normalised by resolveFormat', () => {
    expect(isFontFormat('truetype')).toBe(false);
    expect(isFontFormat('opentype')).toBe(false);
    expect(isFontFormat('embedded-opentype')).toBe(false);
  });
  it('rejects unknown strings', () => {
    expect(isFontFormat('svg')).toBe(false);
    expect(isFontFormat('')).toBe(false);
  });
});

describe('resolveFormat', () => {
  it('prefers the CSS format(...) hint when present', () => {
    expect(resolveFormat(source({ url: 'https://x/y', format: 'woff2' }))).toBe('woff2');
    expect(resolveFormat(source({ url: 'https://x/y', format: 'woff' }))).toBe('woff');
  });

  it("normalises CSS aliases (truetype → ttf, opentype → otf, embedded-opentype → eot)", () => {
    expect(resolveFormat(source({ url: 'https://x/y.bin', format: 'truetype' }))).toBe('ttf');
    expect(resolveFormat(source({ url: 'https://x/y.bin', format: 'opentype' }))).toBe('otf');
    expect(resolveFormat(source({ url: 'https://x/y.bin', format: 'embedded-opentype' }))).toBe('eot');
  });

  it('falls back to the URL extension when format is missing', () => {
    expect(resolveFormat(source({ url: 'https://cdn.example.com/Inter-Regular.woff2' }))).toBe(
      'woff2',
    );
    expect(resolveFormat(source({ url: 'https://cdn.example.com/Inter-Regular.ttf' }))).toBe('ttf');
  });

  it('handles a query string after the extension', () => {
    expect(
      resolveFormat(source({ url: 'https://cdn.example.com/Inter-Regular.woff2?v=3.19' })),
    ).toBe('woff2');
  });

  it('returns null when neither hint nor extension is present', () => {
    expect(resolveFormat(source({ url: 'https://cdn.example.com/p/font' }))).toBeNull();
  });
});

describe('filterFacesByFormat', () => {
  it('keeps only matching sources within each face', () => {
    const f = face('Inter', [
      source({ url: 'https://cdn/Inter.woff2', format: 'woff2' }),
      source({ url: 'https://cdn/Inter.ttf', format: 'truetype' }),
    ]);
    const { kept, dropped } = filterFacesByFormat([f], ['woff2']);
    expect(dropped).toHaveLength(0);
    expect(kept).toHaveLength(1);
    expect(kept[0].sources).toHaveLength(1);
    expect(kept[0].sources[0].format).toBe('woff2');
  });

  it('drops faces whose every source is filtered out', () => {
    const a = face('Inter', [source({ url: 'https://cdn/Inter.woff2', format: 'woff2' })]);
    const b = face('OldFont', [source({ url: 'https://cdn/OldFont.eot', format: 'embedded-opentype' })]);
    const { kept, dropped } = filterFacesByFormat([a, b], ['woff2']);
    expect(kept.map((f) => f.family)).toEqual(['Inter']);
    expect(dropped.map((f) => f.family)).toEqual(['OldFont']);
  });

  it('leaves the original face objects intact (immutable)', () => {
    const f = face('Inter', [
      source({ url: 'https://cdn/Inter.woff2', format: 'woff2' }),
      source({ url: 'https://cdn/Inter.ttf', format: 'truetype' }),
    ]);
    filterFacesByFormat([f], ['woff2']);
    expect(f.sources).toHaveLength(2);
  });

  it('handles multi-format allowlists', () => {
    const f = face('Inter', [
      source({ url: 'https://cdn/Inter.woff2', format: 'woff2' }),
      source({ url: 'https://cdn/Inter.woff', format: 'woff' }),
      source({ url: 'https://cdn/Inter.ttf', format: 'truetype' }),
    ]);
    const { kept } = filterFacesByFormat([f], ['woff2', 'woff']);
    expect(kept[0].sources).toHaveLength(2);
  });
});

describe('urlMatchesFormat', () => {
  it('returns true on matching extension', () => {
    expect(urlMatchesFormat('https://cdn/Inter.woff2', ['woff2'])).toBe(true);
    expect(urlMatchesFormat('https://cdn/Inter.woff2?v=3', ['woff2'])).toBe(true);
  });

  it('returns false on non-matching extension', () => {
    expect(urlMatchesFormat('https://cdn/Inter.ttf', ['woff2'])).toBe(false);
  });

  it('returns false when no extension is detectable', () => {
    expect(urlMatchesFormat('https://cdn/p/font', ['woff2'])).toBe(false);
  });
});
