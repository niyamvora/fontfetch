import { describe, expect, it } from 'vitest';
import { tailwindEmitter } from '../../src/emit/emitters/tailwind.js';
import { makeFaces } from './fixtures.js';

describe('tailwindEmitter', () => {
  const out = tailwindEmitter(makeFaces(), { siteSlug: 'example-com', filesDir: 'files' });

  it('returns a tailwind.fonts.ts file', () => {
    expect(out).not.toBeNull();
    expect(out!.filename).toBe('tailwind.fonts.ts');
  });

  it('imports the Tailwind Config type', () => {
    expect(out!.content).toContain("import type { Config } from 'tailwindcss';");
  });

  it('puts Inter in sans and JetBrains Mono in mono', () => {
    expect(out!.content).toMatch(/sans: \[[^\]]*var\(--font-inter\)/);
    expect(out!.content).toMatch(/mono: \[[^\]]*var\(--font-jetbrains-mono\)/);
  });

  it('emits an alias per family', () => {
    expect(out!.content).toContain("'inter': ['var(--font-inter)'");
    expect(out!.content).toContain("'jetBrainsMono': ['var(--font-jetbrains-mono)'");
  });

  it('returns null for an empty face list', () => {
    expect(tailwindEmitter([], { siteSlug: 'x', filesDir: 'files' })).toBeNull();
  });
});
