/**
 * Discover same-origin internal links from a page's HTML for the multi-page
 * crawl mode (`--pages=N`). Keeps the link set tight: same hostname, http(s)
 * only, deduped, hash stripped. Skips `mailto:`, `tel:`, `javascript:` and
 * fragment-only anchors.
 *
 * The crawler is intentionally shallow — one level deep from the entry URL,
 * no breadth-first expansion. This catches the "homepage links to /blog and
 * /pricing, each uses a different font" case without turning fontfetch into
 * a generic site spider.
 */
import { abs } from '../lib/utils.js';

export const CRAWL_PAGE_CAP = 50;

export interface CrawlOptions {
  /** Maximum number of internal links to return (excluding the entry URL). */
  max: number;
}

const ANCHOR_HREF_RE = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
const SKIPPED_EXT_RE =
  /\.(pdf|zip|tar|gz|tgz|rar|7z|mp4|mp3|wav|webm|avi|mov|m4a|ogg|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|eot|css|js|map|json|xml|rss|atom|txt)(?:\?|#|$)/i;
const SCHEME_SKIP_RE = /^(mailto:|tel:|javascript:|data:|blob:|sms:|whatsapp:|file:)/i;

/**
 * Returns same-origin link URLs in source order (deduped, hash-stripped),
 * excluding the entry URL itself. Caller is responsible for clamping the
 * result against `CrawlOptions.max`.
 */
export function discoverInternalLinks(
  html: string,
  entryUrl: string,
  options: CrawlOptions,
): string[] {
  if (options.max <= 0) return [];

  let entry: URL;
  try {
    entry = new URL(entryUrl);
  } catch {
    return [];
  }

  const entryHost = entry.hostname.replace(/^www\./i, '');
  const entryNormalized = stripHash(entry);
  const out = new Set<string>();

  for (const m of html.matchAll(ANCHOR_HREF_RE)) {
    if (out.size >= options.max) break;
    const raw = m[1].trim();
    if (!raw || raw.startsWith('#')) continue;
    if (SCHEME_SKIP_RE.test(raw)) continue;

    const absolute = abs(raw, entryUrl);
    if (!absolute) continue;

    let parsed: URL;
    try {
      parsed = new URL(absolute);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(parsed.protocol)) continue;

    const host = parsed.hostname.replace(/^www\./i, '');
    if (host !== entryHost) continue;
    if (SKIPPED_EXT_RE.test(parsed.pathname)) continue;

    const normalized = stripHash(parsed);
    if (normalized === entryNormalized) continue;

    out.add(normalized);
  }

  return [...out];
}

function stripHash(u: URL): string {
  const clone = new URL(u.toString());
  clone.hash = '';
  return clone.toString();
}
