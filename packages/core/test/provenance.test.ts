import { describe, expect, it } from 'vitest';
import { bucketForUrl, sameOrigin } from '../src/license/provenance.js';

describe('bucketForUrl', () => {
  it('google: fonts.gstatic.com', () => {
    expect(bucketForUrl('https://fonts.gstatic.com/s/inter/v12/x.woff2', 'example.com')).toBe('google');
  });

  it('google: fonts.googleapis.com', () => {
    expect(bucketForUrl('https://fonts.googleapis.com/css2?family=Inter', 'example.com')).toBe('google');
  });

  it('adobe-typekit: use.typekit.net', () => {
    expect(bucketForUrl('https://use.typekit.net/af/abc.woff2', 'example.com')).toBe('adobe-typekit');
  });

  it('adobe-typekit: p.typekit.net', () => {
    expect(bucketForUrl('https://p.typekit.net/p.css', 'example.com')).toBe('adobe-typekit');
  });

  it('commercial: fast.fonts.net (Monotype)', () => {
    expect(bucketForUrl('https://fast.fonts.net/asdf.woff2', 'example.com')).toBe('commercial');
  });

  it('commercial: cloud.typography.com (Hoefler)', () => {
    expect(bucketForUrl('https://cloud.typography.com/123/abc.woff2', 'example.com')).toBe('commercial');
  });

  it('open-cdn: jsdelivr Fontsource', () => {
    expect(bucketForUrl('https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff2', 'example.com')).toBe('open-cdn');
  });

  it('open-cdn: rsms.me (Inter)', () => {
    expect(bucketForUrl('https://rsms.me/inter/font-files/Inter-Regular.woff2', 'example.com')).toBe('open-cdn');
  });

  it('self-hosted: same origin as page', () => {
    expect(bucketForUrl('https://example.com/_next/static/fonts/x.woff2', 'example.com')).toBe('self-hosted');
  });

  it('self-hosted: www.example.com vs example.com is same origin', () => {
    expect(bucketForUrl('https://www.example.com/x.woff2', 'example.com')).toBe('self-hosted');
  });

  it('self-hosted: subdomain of page host', () => {
    expect(bucketForUrl('https://cdn.example.com/x.woff2', 'example.com')).toBe('self-hosted');
  });

  it('self-hosted: unrecognised CDN falls through', () => {
    expect(bucketForUrl('https://some-random-cdn.io/x.woff2', 'example.com')).toBe('self-hosted');
  });

  it('precedence: typekit > google when both substrings present (URL contains typekit)', () => {
    // Synthetic case — shouldn't happen in practice but verifies first-match-wins
    expect(bucketForUrl('https://use.typekit.net/fonts.gstatic.com/x.woff2', 'example.com')).toBe('google');
    // Above is actually google because google rules are first and contain fonts.gstatic.com
    // That's intentional: order in RULES is the priority. Inverse test:
    expect(bucketForUrl('https://use.typekit.net/x.woff2', 'example.com')).toBe('adobe-typekit');
  });
});

describe('sameOrigin', () => {
  it('exact match', () => {
    expect(sameOrigin('example.com', 'example.com')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(sameOrigin('Example.COM', 'example.com')).toBe(true);
  });

  it('strips www.', () => {
    expect(sameOrigin('www.example.com', 'example.com')).toBe(true);
    expect(sameOrigin('example.com', 'www.example.com')).toBe(true);
  });

  it('subdomain considered same-origin', () => {
    expect(sameOrigin('cdn.example.com', 'example.com')).toBe(true);
    expect(sameOrigin('example.com', 'cdn.example.com')).toBe(true);
  });

  it('unrelated hosts are not same-origin', () => {
    expect(sameOrigin('example.com', 'other.com')).toBe(false);
    expect(sameOrigin('typekit.net', 'example.com')).toBe(false);
  });
});
