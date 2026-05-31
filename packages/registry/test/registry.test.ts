import { describe, expect, it } from 'vitest';
import {
  allPairings,
  findByFamily,
  freeAlternativesFor,
  findByTag,
  allTags,
  allFamilies,
} from '../src/index.js';

describe('@fontfetch/registry', () => {
  it('loads pairings baked from /pairings/*.json', () => {
    const all = allPairings();
    expect(all.length).toBeGreaterThan(0);
    for (const p of all) {
      expect(p.site).toBeTypeOf('string');
      expect(p.url).toMatch(/^https?:\/\//);
      expect(Array.isArray(p.fonts)).toBe(true);
      expect(p.fonts.length).toBeGreaterThan(0);
    }
  });

  it('findByFamily is case-insensitive', () => {
    const families = allFamilies();
    if (families.length === 0) return;
    const sample = families[0];
    expect(findByFamily(sample).length).toBeGreaterThan(0);
    expect(findByFamily(sample.toLowerCase()).length).toBeGreaterThan(0);
    expect(findByFamily(sample.toUpperCase()).length).toBeGreaterThan(0);
  });

  it('findByFamily returns empty array for unknown families', () => {
    expect(findByFamily('NonExistentFontXyz123')).toEqual([]);
  });

  it('freeAlternativesFor returns at most one entry per alternative', () => {
    const all = allPairings();
    const commercial = all
      .flatMap((p) => p.fonts)
      .find((f) => f.license === 'commercial' && (f.free_alternatives?.length ?? 0) > 0);
    if (!commercial) return; // registry might not have a commercial entry yet
    const alts = freeAlternativesFor(commercial.family);
    expect(new Set(alts).size).toBe(alts.length); // deduped
  });

  it('allTags returns sorted unique tags', () => {
    const tags = allTags();
    const sorted = [...tags].sort();
    expect(tags).toEqual(sorted);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('findByTag is case-insensitive', () => {
    const tags = allTags();
    if (tags.length === 0) return;
    const sample = tags[0];
    expect(findByTag(sample.toUpperCase()).length).toBeGreaterThan(0);
  });

  it('allFamilies returns sorted unique families across the whole registry', () => {
    const families = allFamilies();
    const sorted = [...families].sort();
    expect(families).toEqual(sorted);
    expect(new Set(families).size).toBe(families.length);
  });

  it('the returned array is a copy — mutating it does not affect the registry', () => {
    const a = allPairings();
    const before = a.length;
    a.pop();
    expect(allPairings().length).toBe(before);
  });
});
