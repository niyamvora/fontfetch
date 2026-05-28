import type { FontFace, FontFormat, FontSource } from '../types.js';

export const FONT_FORMATS: readonly FontFormat[] = ['woff2', 'woff', 'ttf', 'otf', 'eot'] as const;

export function isFontFormat(s: string): s is FontFormat {
  return (FONT_FORMATS as readonly string[]).includes(s);
}

/**
 * Resolve a source's canonical format. Prefers the CSS `format(...)` hint and
 * normalises the spec aliases (`truetype`, `opentype`, `embedded-opentype`),
 * falling back to the URL extension. Returns null when neither yields a known
 * extension — typically a query-stringed CDN URL with no `format(...)` hint.
 */
export function resolveFormat(s: FontSource): FontFormat | null {
  const fromCss = (s.format ?? '').toLowerCase();
  if (fromCss === 'woff2' || fromCss === 'woff') return fromCss;
  if (fromCss === 'truetype') return 'ttf';
  if (fromCss === 'opentype') return 'otf';
  if (fromCss === 'embedded-opentype') return 'eot';
  const m = /\.(woff2|woff|ttf|otf|eot)(?:\?|$)/i.exec(s.url);
  if (m) return m[1].toLowerCase() as FontFormat;
  return null;
}

/**
 * Apply a format allowlist to a list of @font-face descriptors. Each face's
 * `sources` is filtered down to the matching subset; faces that end up with
 * zero matching sources are dropped and returned separately so the caller can
 * surface them.
 */
export function filterFacesByFormat(
  faces: FontFace[],
  allowed: readonly FontFormat[],
): { kept: FontFace[]; dropped: FontFace[] } {
  const allowedSet = new Set(allowed);
  const kept: FontFace[] = [];
  const dropped: FontFace[] = [];
  for (const f of faces) {
    const matching = f.sources.filter((s) => {
      const fmt = resolveFormat(s);
      return fmt !== null && allowedSet.has(fmt);
    });
    if (matching.length === 0) {
      dropped.push(f);
    } else {
      kept.push({ ...f, sources: matching });
    }
  }
  return { kept, dropped };
}

/** True when the URL's extension is in the allowlist. Used for `<link rel=preload as=font>` URLs that have no FontSource wrapper. */
export function urlMatchesFormat(url: string, allowed: readonly FontFormat[]): boolean {
  const allowedSet = new Set(allowed);
  const m = /\.(woff2|woff|ttf|otf|eot)(?:\?|$)/i.exec(url);
  return m ? allowedSet.has(m[1].toLowerCase() as FontFormat) : false;
}
