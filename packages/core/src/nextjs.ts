/**
 * Next.js `next/font` ships per-subset binaries under
 *   /_next/static/media/<hash>-s.<letter>.<ext>
 * where each sibling letter is a different unicode subset of the same family
 * (latin, latin-ext, cyrillic, greek, etc). A page only loads the subset
 * matching its document language, so the static parser sees a single file —
 * even though the family is published across multiple binaries.
 *
 * This module fills the gap. Given any URL that matches the Next subset
 * pattern, it HEAD-probes the alphabet of siblings in parallel and returns
 * the ones that responded 200. Cheap (26 cancellable requests, ~150ms), and
 * keyed off the letter so we never re-probe one we already have.
 */
import { UA } from './utils.js';

const NEXT_SUBSET_RE =
  /^(.+\/_next\/static\/media\/[^/?#]+-s\.)([a-z0-9]+)(\.(?:woff2|woff|ttf|otf))(\?[^#]*)?(#.*)?$/i;

const SIBLING_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export interface NextjsSubsetMatch {
  /** The portion before the subset letter, including `-s.`. */
  prefix: string;
  /** The subset identifier in the source URL (e.g. `p`). */
  letter: string;
  /** Extension including the leading dot (e.g. `.woff2`). */
  ext: string;
  /** Optional query string (preserved verbatim). */
  query: string;
}

export function parseNextjsSubsetUrl(url: string): NextjsSubsetMatch | null {
  const m = NEXT_SUBSET_RE.exec(url);
  if (!m) return null;
  return { prefix: m[1], letter: m[2], ext: m[3], query: m[4] ?? '' };
}

export function isNextjsSubsetUrl(url: string): boolean {
  return NEXT_SUBSET_RE.test(url);
}

/**
 * Build the candidate sibling URLs for a Next subset URL, excluding the
 * source letter itself. Useful for tests and for dry-run modes.
 */
export function nextjsSiblingCandidates(match: NextjsSubsetMatch): string[] {
  return SIBLING_LETTERS.filter((c) => c !== match.letter.toLowerCase()).map(
    (c) => `${match.prefix}${c}${match.ext}${match.query}`,
  );
}

/**
 * Probe sibling subset URLs in parallel via HEAD. Returns the absolute URLs
 * that responded with a 2xx. Network failures are swallowed (a single 4xx is
 * the expected outcome for letters with no associated subset).
 */
export async function probeNextjsSiblings(
  url: string,
  headers: Record<string, string> = {},
): Promise<string[]> {
  const match = parseNextjsSubsetUrl(url);
  if (!match) return [];
  const candidates = nextjsSiblingCandidates(match);
  const found: string[] = [];
  await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const res = await fetch(candidate, {
          method: 'HEAD',
          headers: { 'User-Agent': UA, ...headers },
          redirect: 'follow',
        });
        if (res.ok) found.push(candidate);
      } catch {
        // network error / DNS / aborted — same outcome as 404, skip.
      }
    }),
  );
  return found.sort();
}
