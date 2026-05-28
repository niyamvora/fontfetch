import { describe, expect, it } from 'vitest';
import { discoverInternalLinks } from '../src/parse/crawl.js';

const HTML = `
<!doctype html>
<html>
  <body>
    <a href="/about">About</a>
    <a href="/blog/launch">Blog post</a>
    <a href="https://acme.com/pricing">Pricing</a>
    <a href="https://www.acme.com/team">Team</a>
    <a href="https://other.com/external">External</a>
    <a href="#section">Anchor</a>
    <a href="mailto:hi@acme.com">Email</a>
    <a href="javascript:void(0)">Script</a>
    <a href="/assets/brochure.pdf">PDF</a>
    <a href="/about">About (dupe)</a>
    <a href="/about#team">About with hash</a>
  </body>
</html>
`;

describe('discoverInternalLinks', () => {
  it('returns same-origin links in source order, deduped, hash-stripped', () => {
    const links = discoverInternalLinks(HTML, 'https://acme.com', { max: 10 });
    expect(links).toEqual([
      'https://acme.com/about',
      'https://acme.com/blog/launch',
      'https://acme.com/pricing',
      'https://www.acme.com/team',
    ]);
  });

  it('clamps to the max parameter', () => {
    const links = discoverInternalLinks(HTML, 'https://acme.com', { max: 2 });
    expect(links).toEqual([
      'https://acme.com/about',
      'https://acme.com/blog/launch',
    ]);
  });

  it('excludes the entry URL itself', () => {
    const html = `<a href="/">Home</a><a href="/about">About</a>`;
    const links = discoverInternalLinks(html, 'https://acme.com/', { max: 5 });
    expect(links).toEqual(['https://acme.com/about']);
  });

  it('treats www and apex as the same origin', () => {
    const html = `<a href="https://www.acme.com/blog">Blog</a>`;
    const links = discoverInternalLinks(html, 'https://acme.com', { max: 5 });
    expect(links).toEqual(['https://www.acme.com/blog']);
  });

  it('skips cross-origin links', () => {
    const html = `<a href="https://other.com/page">Other</a>`;
    const links = discoverInternalLinks(html, 'https://acme.com', { max: 5 });
    expect(links).toEqual([]);
  });

  it('skips non-http(s) schemes', () => {
    const html = `<a href="mailto:x@y.com">m</a><a href="tel:+123">t</a><a href="javascript:void(0)">j</a>`;
    expect(
      discoverInternalLinks(html, 'https://acme.com', { max: 5 }),
    ).toEqual([]);
  });

  it('skips static assets the user almost certainly does not want crawled', () => {
    const html = `
      <a href="/files/brochure.pdf">PDF</a>
      <a href="/img/hero.png">Image</a>
      <a href="/styles/main.css">CSS</a>
      <a href="/scripts/app.js">JS</a>
      <a href="/fonts/Inter.woff2">Font</a>
      <a href="/blog">Blog</a>
    `;
    const links = discoverInternalLinks(html, 'https://acme.com', { max: 5 });
    expect(links).toEqual(['https://acme.com/blog']);
  });

  it('returns [] when max is 0', () => {
    expect(
      discoverInternalLinks(HTML, 'https://acme.com', { max: 0 }),
    ).toEqual([]);
  });

  it('strips hash fragments and dedupes against existing entries', () => {
    const html = `<a href="/about#team">Team</a><a href="/about">About</a>`;
    const links = discoverInternalLinks(html, 'https://acme.com', { max: 5 });
    expect(links).toEqual(['https://acme.com/about']);
  });

  it('returns [] for a malformed entry URL', () => {
    expect(
      discoverInternalLinks(HTML, 'not-a-url', { max: 5 }),
    ).toEqual([]);
  });
});
