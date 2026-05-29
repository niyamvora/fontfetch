import { describe, expect, it } from 'vitest';
import {
  buildPageFaceMap,
  computeConsistency,
  buildConsistencyReport,
  type PageFaceMap,
} from '../src/parse/consistency.js';
import type { FontFace } from '../src/types.js';

function fakeFace(family: string): FontFace {
  return {
    family,
    weight: '400',
    style: 'normal',
    display: null,
    unicodeRange: null,
    sources: [{ url: `https://cdn.example.com/${family}.woff2`, format: 'woff2' }],
  };
}

describe('buildPageFaceMap', () => {
  it('attributes each source\'s faces back to its page-of-origin', () => {
    const pageUrls = ['https://example.com/', 'https://example.com/blog'];
    const sourceToPage = [0, 0, 1]; // first two sources on entry, third on /blog
    const facesPerSource = [[fakeFace('Inter')], [fakeFace('Geist')], [fakeFace('Tiempos')]];
    const map = buildPageFaceMap(pageUrls, sourceToPage, facesPerSource);
    expect(map[0].url).toBe('https://example.com/');
    expect(map[0].families.sort()).toEqual(['Geist', 'Inter']);
    expect(map[1].url).toBe('https://example.com/blog');
    expect(map[1].families).toEqual(['Tiempos']);
  });

  it('returns empty family sets for pages with no faces', () => {
    const map = buildPageFaceMap(['https://example.com/'], [], []);
    expect(map[0].families).toEqual([]);
  });
});

describe('computeConsistency', () => {
  it('returns empty report when zero pages', () => {
    const report = computeConsistency([]);
    expect(report.shared).toEqual([]);
    expect(report.divergent).toEqual([]);
  });

  it('reports zero divergence when every page sees the same families', () => {
    const pages: PageFaceMap[] = [
      { url: '/', families: ['Inter', 'Geist Mono'] },
      { url: '/blog', families: ['Inter', 'Geist Mono'] },
    ];
    const report = computeConsistency(pages);
    expect(report.shared.sort()).toEqual(['Geist Mono', 'Inter']);
    expect(report.divergent).toEqual([]);
  });

  it('flags a page that adds a family the entry page does not have', () => {
    const pages: PageFaceMap[] = [
      { url: '/', families: ['Inter'] },
      { url: '/blog', families: ['Inter', 'Tiempos'] },
    ];
    const report = computeConsistency(pages);
    expect(report.shared).toEqual(['Inter']);
    expect(report.divergent).toHaveLength(1);
    expect(report.divergent[0].url).toBe('/blog');
    expect(report.divergent[0].onlyHere).toEqual(['Tiempos']);
    expect(report.divergent[0].missingHere).toEqual([]);
  });

  it('flags a page that drops a family the entry page has', () => {
    const pages: PageFaceMap[] = [
      { url: '/', families: ['Inter', 'Geist'] },
      { url: '/about', families: ['Inter'] },
    ];
    const report = computeConsistency(pages);
    expect(report.shared).toEqual(['Inter']);
    expect(report.divergent[0].missingHere).toEqual(['Geist']);
    expect(report.divergent[0].onlyHere).toEqual([]);
  });

  it('captures both added and dropped families per divergent page', () => {
    const pages: PageFaceMap[] = [
      { url: '/', families: ['Inter', 'Geist'] },
      { url: '/blog', families: ['Inter', 'Tiempos', 'Söhne'] },
    ];
    const report = computeConsistency(pages);
    expect(report.shared).toEqual(['Inter']);
    expect(report.divergent[0].onlyHere.sort()).toEqual(['Söhne', 'Tiempos']);
    expect(report.divergent[0].missingHere).toEqual(['Geist']);
  });
});

describe('buildConsistencyReport', () => {
  it('renders the markdown headers + lists', () => {
    const md = buildConsistencyReport(
      {
        shared: ['Inter'],
        perPage: [
          { url: '/', families: ['Inter'] },
          { url: '/blog', families: ['Inter', 'Tiempos'] },
        ],
        divergent: [{ url: '/blog', onlyHere: ['Tiempos'], missingHere: [] }],
      },
      'example.com',
    );
    expect(md).toContain('# Cross-page font consistency for example.com');
    expect(md).toContain('## Shared across every page');
    expect(md).toContain('- Inter');
    expect(md).toContain('## Per-page families');
    expect(md).toContain('### /');
    expect(md).toContain('### /blog');
    expect(md).toContain('## Divergence from the entry page');
    expect(md).toContain('**Only here**: Tiempos');
  });

  it('handles the "no shared families" case gracefully', () => {
    const md = buildConsistencyReport(
      { shared: [], perPage: [{ url: '/', families: ['Inter'] }], divergent: [] },
      'example.com',
    );
    expect(md).toContain('_No families appeared on every page._');
  });

  it('omits the divergence section when nothing diverges', () => {
    const md = buildConsistencyReport(
      {
        shared: ['Inter'],
        perPage: [
          { url: '/', families: ['Inter'] },
          { url: '/blog', families: ['Inter'] },
        ],
        divergent: [],
      },
      'example.com',
    );
    expect(md).not.toContain('## Divergence');
  });
});
