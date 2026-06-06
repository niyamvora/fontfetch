import { describe, expect, it } from 'vitest';
import { isWoff2, compressWoff2, decompressWoff2 } from '../src/woff2.js';
import { loadFont, glyphCount } from '../src/io.js';
import { makeTestFont } from './helpers.js';

describe('woff2 detection', () => {
  it('recognises the wOF2 signature', () => {
    expect(isWoff2(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0]))).toBe(true);
  });
  it('rejects a TrueType signature', () => {
    expect(isWoff2(makeTestFont())).toBe(false);
  });
  it('rejects too-short input', () => {
    expect(isWoff2(new Uint8Array([0x77, 0x4f]))).toBe(false);
  });
});

describe('woff2 round-trip', () => {
  it('compresses a TTF to WOFF2 then decompresses back to a parseable font', async () => {
    const ttf = makeTestFont();
    const woff2 = await compressWoff2(ttf);
    expect(isWoff2(woff2)).toBe(true);

    const back = await decompressWoff2(woff2);
    expect(isWoff2(back)).toBe(false);
    // The decompressed binary is loadable and keeps its glyphs.
    expect(glyphCount(loadFont(back))).toBe(2);
  });
});
