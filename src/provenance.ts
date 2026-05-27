/**
 * Source-bucket classification for font URLs. Used to organise the per-site
 * `files/` directory into subfolders so the free-vs-licensed split is visible
 * at a glance.
 *
 * Decision order (first match wins):
 *   1. google         — Google Fonts CDN family (gstatic, googleapis, mirror)
 *   2. adobe-typekit  — Adobe Fonts / Typekit
 *   3. commercial     — Other commercial foundry CDNs (Monotype, Hoefler, etc.)
 *   4. open-cdn       — Other recognised open CDNs (Fontsource, rsms.me, etc.)
 *   5. self-hosted    — Same origin as the page, OR anything we couldn't classify
 */

export type Bucket = 'google' | 'adobe-typekit' | 'commercial' | 'open-cdn' | 'self-hosted';

export const BUCKETS: Bucket[] = ['google', 'adobe-typekit', 'commercial', 'open-cdn', 'self-hosted'];

interface BucketRule {
  bucket: Bucket;
  patterns: string[];
}

const RULES: BucketRule[] = [
  {
    bucket: 'google',
    patterns: ['fonts.gstatic.com', 'fonts.googleapis.com', 'cdn.jsdelivr.net/gh/google/fonts'],
  },
  {
    bucket: 'adobe-typekit',
    patterns: ['use.typekit.net', 'p.typekit.net', 'fonts.adobe.com'],
  },
  {
    bucket: 'commercial',
    patterns: [
      'fast.fonts.net',
      'cloud.typography.com',
      'cloud.typenetwork.com',
      'use.fontawesome.com',
      'fontstand.com',
    ],
  },
  {
    bucket: 'open-cdn',
    patterns: ['cdn.jsdelivr.net/npm/@fontsource/', 'rsms.me'],
  },
];

/** Strip leading "www." so `www.example.com` and `example.com` compare equal. */
function strip(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

/** Same-origin if hosts are equal, or one is a subdomain of the other. */
export function sameOrigin(urlHost: string, pageHost: string): boolean {
  const a = strip(urlHost);
  const b = strip(pageHost);
  if (a === b) return true;
  return a.endsWith('.' + b) || b.endsWith('.' + a);
}

/**
 * Classify a single font URL into a bucket given the page that referenced it.
 * `pageHost` is the hostname of the URL the user passed to fontfetch
 * (used to detect "same-origin = self-hosted").
 */
export function bucketForUrl(url: string, pageHost: string): Bucket {
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (url.includes(pattern)) return rule.bucket;
    }
  }
  try {
    const u = new URL(url);
    if (sameOrigin(u.hostname, pageHost)) return 'self-hosted';
  } catch {
    // unparseable URL — fall through to self-hosted
  }
  return 'self-hosted';
}
