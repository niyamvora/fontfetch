import { describe, expect, it } from 'vitest';
import {
  isNextjsSubsetUrl,
  parseNextjsSubsetUrl,
  nextjsSiblingCandidates,
} from '../src/nextjs.js';

describe('isNextjsSubsetUrl', () => {
  it('matches the canonical Next.js next/font subset path', () => {
    expect(
      isNextjsSubsetUrl(
        'https://acme.com/_next/static/media/c9a5bc6a7c948fb0-s.p.woff2',
      ),
    ).toBe(true);
  });

  it('matches with a multi-character subset identifier', () => {
    expect(
      isNextjsSubsetUrl('https://acme.com/_next/static/media/abcd-s.latin.woff2'),
    ).toBe(true);
  });

  it('matches subset URLs that carry a query string', () => {
    expect(
      isNextjsSubsetUrl(
        'https://acme.com/_next/static/media/c9a5bc6a7c948fb0-s.p.woff2?v=1',
      ),
    ).toBe(true);
  });

  it('rejects font URLs not under _next/static/media', () => {
    expect(isNextjsSubsetUrl('https://acme.com/fonts/Inter-s.p.woff2')).toBe(false);
  });

  it('rejects font URLs that lack the -s. infix', () => {
    expect(
      isNextjsSubsetUrl('https://acme.com/_next/static/media/c9a5bc-Inter.woff2'),
    ).toBe(false);
  });

  it('rejects non-font extensions', () => {
    expect(
      isNextjsSubsetUrl('https://acme.com/_next/static/media/abc-s.p.css'),
    ).toBe(false);
  });
});

describe('parseNextjsSubsetUrl', () => {
  it('extracts prefix, letter, and extension', () => {
    const m = parseNextjsSubsetUrl(
      'https://acme.com/_next/static/media/c9a5bc6a7c948fb0-s.p.woff2',
    );
    expect(m).not.toBeNull();
    expect(m!.prefix).toBe(
      'https://acme.com/_next/static/media/c9a5bc6a7c948fb0-s.',
    );
    expect(m!.letter).toBe('p');
    expect(m!.ext).toBe('.woff2');
    expect(m!.query).toBe('');
  });

  it('preserves the query string', () => {
    const m = parseNextjsSubsetUrl(
      'https://acme.com/_next/static/media/abcd-s.p.woff2?v=42',
    );
    expect(m).not.toBeNull();
    expect(m!.query).toBe('?v=42');
  });

  it('returns null for non-matching URLs', () => {
    expect(parseNextjsSubsetUrl('https://acme.com/index.html')).toBeNull();
  });
});

describe('nextjsSiblingCandidates', () => {
  it('builds 25 candidate URLs (a..z minus the source letter)', () => {
    const m = parseNextjsSubsetUrl(
      'https://acme.com/_next/static/media/abc-s.p.woff2',
    )!;
    const siblings = nextjsSiblingCandidates(m);
    expect(siblings).toHaveLength(25);
    expect(siblings).not.toContain(
      'https://acme.com/_next/static/media/abc-s.p.woff2',
    );
    expect(siblings).toContain(
      'https://acme.com/_next/static/media/abc-s.q.woff2',
    );
    expect(siblings).toContain(
      'https://acme.com/_next/static/media/abc-s.a.woff2',
    );
  });

  it('preserves the query string across all candidates', () => {
    const m = parseNextjsSubsetUrl(
      'https://acme.com/_next/static/media/abc-s.p.woff2?v=1',
    )!;
    const siblings = nextjsSiblingCandidates(m);
    expect(siblings.every((u) => u.endsWith('.woff2?v=1'))).toBe(true);
  });
});
