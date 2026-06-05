import { describe, expect, it } from 'vitest';
import { morph } from '../src/morph.js';
import { loadFont, readGlyphCommands } from '../src/io.js';
import { readFamily } from '../src/naming.js';
import { makeTestFont } from './helpers.js';

function rightExtentOfA(binary: Uint8Array): number {
  const font = loadFont(binary);
  return font.glyphs.get(1).path.getBoundingBox().x2;
}

describe('morph end-to-end', () => {
  it('returns a valid, reloadable font with no options', () => {
    const { font, warnings } = morph(makeTestFont());
    expect(warnings).toEqual([]);
    expect(loadFont(font).glyphs.length).toBe(2);
  });

  it('width widens the glyph and its advance', () => {
    const base = makeTestFont();
    const baseAdvance = loadFont(base).glyphs.get(1).advanceWidth;
    const { font, applied } = morph(base, { width: 120 });
    expect(applied.width).toBe(120);
    expect(rightExtentOfA(font)).toBeGreaterThan(rightExtentOfA(base));
    expect(loadFont(font).glyphs.get(1).advanceWidth).toBe(Math.round(baseAdvance * 1.2));
  });

  it('round adds fillet curves to the square', () => {
    const { font } = morph(makeTestFont(), { round: 60 });
    const a = readGlyphCommands(loadFont(font).glyphs.get(1));
    // Fillets are emitted as quadratics; opentype's writer may re-encode them
    // as cubics on the round-trip, so accept either curve type.
    expect(a.some((c) => c.type === 'Q' || c.type === 'C')).toBe(true);
  });

  it('slant leans the outline without changing its height', () => {
    const base = makeTestFont();
    const { font } = morph(base, { slant: 12 });
    const before = loadFont(base).glyphs.get(1).path.getBoundingBox();
    const after = loadFont(font).glyphs.get(1).path.getBoundingBox();
    expect(after.y2 - after.y1).toBeCloseTo(before.y2 - before.y1, 0); // height held
    expect(after.x2).toBeGreaterThan(before.x2); // sheared right
  });

  it('flags experimental static weight', () => {
    const { warnings, applied } = morph(makeTestFont(), { weight: 10 });
    expect(applied.weight).toBe(10);
    expect(warnings.join(' ')).toMatch(/experimental/i);
  });

  it('clamps out-of-range sliders and reports it', () => {
    const { applied, warnings } = morph(makeTestFont(), { width: 999, weight: 50 });
    expect(applied.width).toBe(120);
    expect(applied.weight).toBe(15);
    expect(warnings.join(' ')).toMatch(/clamped/);
  });

  it('composes multiple sliders in one pass', () => {
    const { font, applied } = morph(makeTestFont(), { width: 110, slant: 8, round: 40 });
    expect(applied).toMatchObject({ width: 110, slant: 8, round: 40, weight: 0 });
    expect(loadFont(font).glyphs.length).toBe(2);
  });

  it('applies rename and watermark in the same pass', () => {
    const { font, renamedTo, watermarked } = morph(makeTestFont(), {
      slant: 6,
      rename: 'Test Prototype',
      watermark: 'PROTOTYPE — not for production',
    });
    expect(renamedTo).toBe('Test Prototype');
    expect(watermarked).toBe(true);
    expect(readFamily(loadFont(font))).toBe('Test Prototype');
  });

  it('renames even with no slider transforms', () => {
    const { font, applied } = morph(makeTestFont(), { rename: 'Just Renamed' });
    expect(applied).toMatchObject({ round: 0, width: 100, slant: 0, weight: 0 });
    expect(readFamily(loadFont(font))).toBe('Just Renamed');
  });
});
