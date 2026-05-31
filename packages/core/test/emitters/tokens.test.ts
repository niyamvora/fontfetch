import { describe, expect, it } from 'vitest';
import { tokensEmitter } from '../../src/emit/emitters/tokens.js';
import type { FontFace } from '../../src/types.js';

function face(family: string, weight = '400', style = 'normal'): FontFace {
  return {
    family,
    weight,
    style,
    display: null,
    unicodeRange: null,
    sources: [
      { url: `https://cdn.example.com/${family}.woff2`, format: 'woff2', localFile: `google/${family}.woff2` },
    ],
  };
}

function emit(faces: FontFace[]): { filename: string; content: unknown } | null {
  const out = tokensEmitter(faces, { siteSlug: 'example', filesDir: 'files' });
  if (!out) return null;
  return { filename: out.filename, content: JSON.parse(out.content) };
}

describe('tokensEmitter', () => {
  it('returns null when no faces are provided', () => {
    expect(tokensEmitter([], { siteSlug: 'example', filesDir: 'files' })).toBeNull();
  });

  it('emits a fonts.tokens.json file with the DTCG schema reference', () => {
    const out = emit([face('Inter')]);
    expect(out?.filename).toBe('fonts.tokens.json');
    const tokens = out?.content as { $schema: string };
    expect(tokens.$schema).toContain('design-tokens');
  });

  it('emits one fontFamily token per family, kebab-cased', () => {
    const out = emit([face('Inter'), face('JetBrains Mono')]);
    const tokens = out?.content as { font: { family: Record<string, { $type: string; $value: string[] }> } };
    expect(tokens.font.family).toHaveProperty('inter');
    expect(tokens.font.family).toHaveProperty('jetbrains-mono');
    expect(tokens.font.family.inter.$type).toBe('fontFamily');
    expect(tokens.font.family.inter.$value[0]).toBe('Inter');
    expect(tokens.font.family.inter.$value).toContain('Inter Fallback');
  });

  it('emits one fontWeight token per unique weight, labelled conventionally', () => {
    const out = emit([face('Inter', '400'), face('Inter', '700'), face('Inter', '900')]);
    const tokens = out?.content as { font: { weight: Record<string, { $type: string; $value: number }> } };
    expect(tokens.font.weight.regular.$value).toBe(400);
    expect(tokens.font.weight.bold.$value).toBe(700);
    expect(tokens.font.weight.black.$value).toBe(900);
    expect(tokens.font.weight.regular.$type).toBe('fontWeight');
  });

  it('emits a default font-size ladder matching Tailwind defaults', () => {
    const out = emit([face('Inter')]);
    const tokens = out?.content as { font: { size: Record<string, { $type: string; $value: string }> } };
    expect(tokens.font.size.xs.$value).toBe('0.75rem');
    expect(tokens.font.size.base.$value).toBe('1rem');
    expect(tokens.font.size['4xl'].$value).toBe('2.25rem');
    expect(tokens.font.size.base.$type).toBe('dimension');
  });

  it('emits a line-height ladder with sensible defaults', () => {
    const out = emit([face('Inter')]);
    const tokens = out?.content as { font: { lineHeight: Record<string, { $type: string; $value: number }> } };
    expect(tokens.font.lineHeight.tight.$value).toBe(1.2);
    expect(tokens.font.lineHeight.normal.$value).toBe(1.5);
    expect(tokens.font.lineHeight.loose.$value).toBe(2);
  });

  it('dedupes weights when the same value appears across multiple families', () => {
    const out = emit([face('Inter', '400'), face('Geist', '400')]);
    const tokens = out?.content as { font: { weight: Record<string, unknown> } };
    expect(Object.keys(tokens.font.weight)).toEqual(['regular']);
  });
});
