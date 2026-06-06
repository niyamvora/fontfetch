import { describe, expect, it } from 'vitest';
import { loadFont, saveFont, glyphCount, readGlyphCommands, writeGlyphCommands } from '../src/io.js';
import { makeTestFont, squareCommands } from './helpers.js';

describe('font io round-trip', () => {
  it('loads a synthetic font and reports its glyphs', () => {
    const font = loadFont(makeTestFont());
    expect(glyphCount(font)).toBe(2); // .notdef + A
  });

  it('save → reload preserves glyph count and the A outline', () => {
    const font = loadFont(makeTestFont());
    const reloaded = loadFont(saveFont(font));
    expect(glyphCount(reloaded)).toBe(2);
    const a = readGlyphCommands(reloaded.glyphs.get(1));
    // A closed square survives as a move + line(s) + close.
    expect(a[0]!.type).toBe('M');
    expect(a.some((c) => c.type === 'Z')).toBe(true);
  });

  it('writeGlyphCommands replaces an outline that then survives serialisation', () => {
    const font = loadFont(makeTestFont());
    writeGlyphCommands(font.glyphs.get(1), squareCommands(0, 0, 500));
    const reloaded = loadFont(saveFont(font));
    const a = reloaded.glyphs.get(1);
    // The new 500-unit square shifts the right extent to ~500.
    expect(a.path.getBoundingBox().x2).toBeCloseTo(500, 0);
  });

  it('rejects non-font input', () => {
    expect(() => loadFont(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});
