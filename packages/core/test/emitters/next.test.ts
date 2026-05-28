import { describe, expect, it } from 'vitest';
import { nextEmitter } from '../../src/emit/emitters/next.js';
import { makeFaces } from './fixtures.js';

describe('nextEmitter', () => {
  const out = nextEmitter(makeFaces(), { siteSlug: 'example-com', filesDir: 'files' });

  it('returns a next.fonts.ts file', () => {
    expect(out).not.toBeNull();
    expect(out!.filename).toBe('next.fonts.ts');
  });

  it('imports next/font/local', () => {
    expect(out!.content).toContain("import localFont from 'next/font/local';");
  });

  it('emits one localFont call per family (deduped)', () => {
    const calls = out!.content.match(/localFont\(\{/g) ?? [];
    expect(calls.length).toBe(2);
  });

  it('uses camelCase JS identifiers', () => {
    expect(out!.content).toContain('export const inter = localFont({');
    expect(out!.content).toContain('export const jetBrainsMono = localFont({');
  });

  it('groups all faces of a family into one src array', () => {
    expect(out!.content).toContain("path: './files/Inter-Regular.woff2', weight: '400', style: 'normal'");
    expect(out!.content).toContain("path: './files/Inter-Bold.woff2', weight: '700', style: 'normal'");
  });

  it('exposes a CSS variable per family', () => {
    expect(out!.content).toContain("variable: '--font-inter'");
    expect(out!.content).toContain("variable: '--font-jetbrains-mono'");
  });

  it('returns null for an empty face list', () => {
    expect(nextEmitter([], { siteSlug: 'x', filesDir: 'files' })).toBeNull();
  });
});
