/**
 * `@fontfetch/registry` — typed access to the fontfetch community pairings
 * registry.
 *
 * The pairings JSON files live under `/pairings/*.json` in the fontfetch
 * repository. This package bakes them into a single `pairings.json` at
 * build time, ships the data with the npm tarball, and exposes typed
 * query helpers so third-party tooling can consume the registry with full
 * TypeScript autocomplete.
 *
 * Usage:
 *
 * ```ts
 * import { allPairings, findByFamily, freeAlternativesFor } from '@fontfetch/registry';
 *
 * allPairings();                  // every entry, typed
 * findByFamily('Söhne');           // [{ site: 'Stripe', ... }, ...]
 * freeAlternativesFor('Söhne');    // ['Inter', 'Söhne (OFL fork)']
 * ```
 */
import baked from './pairings.generated.js';
import type { Pairing } from './types.js';

export type { Pairing, PairingFont, FontLicense } from './types.js';

/** Returns every pairing in the registry, in registry filename order. */
export function allPairings(): Pairing[] {
  return baked.slice();
}

/**
 * Find all pairings that use a given font family. Case-insensitive match
 * on the `font.family` field. Empty array when nothing matches.
 *
 * @example
 *   findByFamily('Söhne')  // [{ site: 'Stripe', fonts: [...], ... }]
 */
export function findByFamily(family: string): Pairing[] {
  const needle = family.trim().toLowerCase();
  return baked.filter((p) =>
    p.fonts.some((f) => f.family.toLowerCase() === needle),
  );
}

/**
 * Free-alternative recommendations for a given family, deduped across the
 * registry. Returns the most-cited alternatives first.
 *
 * @example
 *   freeAlternativesFor('Söhne')  // ['Inter', 'Söhne (OFL fork)', ...]
 */
export function freeAlternativesFor(family: string): string[] {
  const needle = family.trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const p of baked) {
    for (const f of p.fonts) {
      if (f.family.toLowerCase() !== needle) continue;
      for (const alt of f.free_alternatives ?? []) {
        counts.set(alt, (counts.get(alt) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([alt]) => alt);
}

/**
 * Filter pairings by tag. Case-insensitive match against the `tags` array.
 */
export function findByTag(tag: string): Pairing[] {
  const needle = tag.trim().toLowerCase();
  return baked.filter((p) => (p.tags ?? []).some((t) => t.toLowerCase() === needle));
}

/** Returns every unique tag in the registry, alphabetised. */
export function allTags(): string[] {
  const set = new Set<string>();
  for (const p of baked) for (const t of p.tags ?? []) set.add(t);
  return [...set].sort();
}

/** Returns every unique family name in the registry, alphabetised. */
export function allFamilies(): string[] {
  const set = new Set<string>();
  for (const p of baked) for (const f of p.fonts) set.add(f.family);
  return [...set].sort();
}
