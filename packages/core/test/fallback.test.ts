import { describe, expect, it } from 'vitest';
import { pickGenericFallback, formatFallbackCss } from '../src/inspect/fallback.js';

describe('pickGenericFallback', () => {
  it('routes obvious monospace family names to monospace', () => {
    expect(pickGenericFallback('JetBrains Mono')).toBe('monospace');
    expect(pickGenericFallback('Fira Code')).toBe('monospace');
    expect(pickGenericFallback('Source Code Pro')).toBe('monospace');
    expect(pickGenericFallback('IBM Plex Mono')).toBe('monospace');
  });

  it('routes obvious serif family names to serif', () => {
    expect(pickGenericFallback('Source Serif Pro')).toBe('serif');
    expect(pickGenericFallback('EB Garamond')).toBe('serif');
    expect(pickGenericFallback('Times New Roman')).toBe('serif');
    expect(pickGenericFallback('Georgia')).toBe('serif');
  });

  it('defaults to sans-serif for everything else', () => {
    expect(pickGenericFallback('Inter')).toBe('sans-serif');
    expect(pickGenericFallback('Geist')).toBe('sans-serif');
    expect(pickGenericFallback('Söhne')).toBe('sans-serif');
    expect(pickGenericFallback('Anonymous Sans')).toBe('sans-serif');
  });
});

describe('formatFallbackCss', () => {
  it('emits a complete @font-face block with all four overrides', () => {
    const css = formatFallbackCss({
      familyName: 'Inter',
      fallbackFamily: 'Inter Fallback',
      generic: 'sans-serif',
      sizeAdjust: '107.4%',
      ascentOverride: '90%',
      descentOverride: '22.4%',
      lineGapOverride: '0%',
    });
    expect(css).toContain("font-family: 'Inter Fallback'");
    expect(css).toContain("src: local('Arial')");
    expect(css).toContain('size-adjust: 107.4%');
    expect(css).toContain('ascent-override: 90%');
    expect(css).toContain('descent-override: 22.4%');
    expect(css).toContain('line-gap-override: 0%');
  });

  it('targets Times New Roman for serif fallbacks', () => {
    const css = formatFallbackCss({
      familyName: 'Source Serif',
      fallbackFamily: 'Source Serif Fallback',
      generic: 'serif',
      sizeAdjust: '100%',
      ascentOverride: 'normal',
      descentOverride: 'normal',
      lineGapOverride: 'normal',
    });
    expect(css).toContain("src: local('Times New Roman')");
  });

  it('targets Courier New for monospace fallbacks', () => {
    const css = formatFallbackCss({
      familyName: 'JetBrains Mono',
      fallbackFamily: 'JetBrains Mono Fallback',
      generic: 'monospace',
      sizeAdjust: '100%',
      ascentOverride: 'normal',
      descentOverride: 'normal',
      lineGapOverride: 'normal',
    });
    expect(css).toContain("src: local('Courier New')");
  });
});