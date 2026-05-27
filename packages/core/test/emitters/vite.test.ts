import { describe, expect, it } from 'vitest';
import { viteEmitter } from '../../src/emitters/vite.js';
import { makeFaces } from './fixtures.js';

describe('viteEmitter', () => {
  const out = viteEmitter(makeFaces(), { siteSlug: 'example-com', filesDir: 'files' });

  it('returns a vite.fonts.md file', () => {
    expect(out).not.toBeNull();
    expect(out!.filename).toBe('vite.fonts.md');
  });

  it('shows the import line for fonts.css', () => {
    expect(out!.content).toContain("import './assets/fonts/<site>/fonts.css';");
  });

  it('lists each family by name', () => {
    expect(out!.content).toContain("font-family: 'Inter';");
    expect(out!.content).toContain("font-family: 'JetBrains Mono';");
  });

  it('returns null for an empty face list', () => {
    expect(viteEmitter([], { siteSlug: 'x', filesDir: 'files' })).toBeNull();
  });
});
