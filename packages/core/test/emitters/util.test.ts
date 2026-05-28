import { describe, expect, it } from 'vitest';
import { familyToIdent, familyToKebab, tailwindBucket } from '../../src/emit/emitters/util.js';

describe('familyToIdent', () => {
  it('camelCases multi-word families', () => {
    expect(familyToIdent('JetBrains Mono')).toBe('jetBrainsMono');
    expect(familyToIdent('Inter Display')).toBe('interDisplay');
  });

  it('strips punctuation and quotes', () => {
    expect(familyToIdent('Söhne Mono')).toBe('sHneMono');
    expect(familyToIdent('"Geist"')).toBe('geist');
  });

  it('lowercases a single-word family', () => {
    expect(familyToIdent('Inter')).toBe('inter');
  });
});

describe('familyToKebab', () => {
  it('produces lowercase hyphenated CSS-var-safe slugs', () => {
    expect(familyToKebab('JetBrains Mono')).toBe('jetbrains-mono');
    expect(familyToKebab('Inter Display')).toBe('inter-display');
    expect(familyToKebab('Söhne Mono')).toBe('s-hne-mono');
  });
});

describe('tailwindBucket', () => {
  it('routes mono families to mono', () => {
    expect(tailwindBucket('JetBrains Mono')).toBe('mono');
    expect(tailwindBucket('Geist Mono')).toBe('mono');
    expect(tailwindBucket('Courier New')).toBe('mono');
  });

  it('routes serif families to serif', () => {
    expect(tailwindBucket('Tiempos Headline')).toBe('serif');
    expect(tailwindBucket('Garamond')).toBe('serif');
  });

  it('defaults to sans', () => {
    expect(tailwindBucket('Inter')).toBe('sans');
    expect(tailwindBucket('Geist')).toBe('sans');
  });

  it('routes Sans Serif / SansSerif to sans, not serif (regression)', () => {
    expect(tailwindBucket('KaTeX_SansSerif')).toBe('sans');
    expect(tailwindBucket('Sans Serif')).toBe('sans');
    expect(tailwindBucket('Foo SansSerif')).toBe('sans');
  });
});
