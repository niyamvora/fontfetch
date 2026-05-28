import type { FontFace } from '../../types.js';

/**
 * Strip non-alphanumeric chars and camelCase the family for use as a JS identifier.
 * Preserves interior capitals so "JetBrains Mono" → "jetBrainsMono", not "jetbrainsMono".
 */
export function familyToIdent(family: string): string {
  const cleaned = family.replace(/[^A-Za-z0-9 ]+/g, ' ').trim();
  if (!cleaned) return 'font';
  const parts = cleaned.split(/\s+/);
  const first = parts[0][0].toLowerCase() + parts[0].slice(1);
  const rest = parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1));
  return [first, ...rest].join('');
}

/** kebab-case the family for use in CSS variables / file-suggesting */
export function familyToKebab(family: string): string {
  return family
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Best-guess Tailwind bucket for a family. Order matters: 'mono' wins over
 * 'sans'/'serif', and 'sans' is checked before 'serif' so that "Sans Serif"
 * and "SansSerif" route to sans rather than getting trapped by the "serif"
 * substring match.
 */
export function tailwindBucket(family: string): 'sans' | 'serif' | 'mono' {
  const f = family.toLowerCase();
  if (/(mono|code|console|courier|consolas)/.test(f)) return 'mono';
  if (/sans/.test(f)) return 'sans';
  if (/(serif|garamond|caslon|baskerville|times|georgia|plantijn|tiempos)/.test(f)) return 'serif';
  return 'sans';
}

/** Group faces by family, preserving first-seen order. */
export function groupByFamily(faces: FontFace[]): Map<string, FontFace[]> {
  const out = new Map<string, FontFace[]>();
  for (const f of faces) {
    const existing = out.get(f.family);
    if (existing) existing.push(f);
    else out.set(f.family, [f]);
  }
  return out;
}

/** Pick a single representative file per (weight, style) — prefers woff2. */
export function pickPrimaryFile(face: FontFace): { file: string; format: string | null } | null {
  if (face.sources.length === 0) return null;
  const woff2 = face.sources.find((s) => s.format === 'woff2');
  const chosen = woff2 ?? face.sources[0];
  if (!chosen.localFile) return null;
  return { file: chosen.localFile, format: chosen.format };
}
