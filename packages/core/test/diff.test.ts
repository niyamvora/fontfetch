import { describe, expect, it, vi } from 'vitest';
import type { FontFace, PullResult } from '../src/types.js';

const pullMock = vi.hoisted(() => vi.fn());

vi.mock('../src/pipeline/pull.js', () => ({ pull: pullMock }));

const { diffPulls, formatFontDiff } = await import('../src/pipeline/diff.js');

function face(family: string, localFile: string, sourceUrl?: string): FontFace {
  return {
    family,
    weight: '400',
    style: 'normal',
    display: null,
    unicodeRange: null,
    sources: [
      {
        url: sourceUrl ?? `https://cdn.example.com/${localFile}`,
        format: 'woff2',
        localFile,
      },
    ],
  };
}

function result(faces: FontFace[], sizes: Record<string, number>): PullResult {
  return {
    outDir: '/tmp/x',
    faces,
    orphans: [],
    downloaded: faces.length,
    total: faces.length,
    variableFonts: [],
    pagesCrawled: 1,
    discoveredNextjsSiblings: [],
    fileSizes: sizes,
  };
}

describe('diffPulls', () => {
  it('reports added/removed/shared families and byte delta', async () => {
    pullMock
      .mockResolvedValueOnce(
        result(
          [
            face('Inter', 'google/Inter.woff2'),
            face('Söhne', 'adobe-typekit/Sohne.woff2', 'https://use.typekit.net/abc/sohne.woff2'),
          ],
          { 'google/Inter.woff2': 30_000, 'adobe-typekit/Sohne.woff2': 50_000 },
        ),
      )
      .mockResolvedValueOnce(
        result(
          [
            face('Inter Display', 'google/Inter-Display.woff2'),
            face('Inter', 'google/Inter.woff2'),
          ],
          { 'google/Inter-Display.woff2': 40_000, 'google/Inter.woff2': 30_000 },
        ),
      );

    const diff = await diffPulls('https://a.com', 'https://b.com', '/tmp');

    expect(diff.schemaVersion).toBe('1.0');
    expect(diff.shared).toEqual(['Inter']);
    expect(diff.added).toEqual(['Inter Display']);
    expect(diff.removed).toEqual(['Söhne']);
    expect(diff.byteDelta).toBe(70_000 - 80_000);
    // A had 1 commercial (Söhne via Typekit), B has 0
    expect(diff.commercialDelta).toBe(-1);
  });
});

describe('formatFontDiff', () => {
  it('renders Added / Removed / Shared sections with byte delta', () => {
    const md = formatFontDiff({
      schemaVersion: '1.0',
      generatedAt: '2026-05-29T00:00:00Z',
      a: { url: 'https://a.com', families: ['Inter'], totalBytes: 30_000, commercialCount: 0, fileCount: 1 },
      b: { url: 'https://b.com', families: ['Inter', 'Tiempos'], totalBytes: 50_000, commercialCount: 0, fileCount: 2 },
      added: ['Tiempos'],
      removed: [],
      shared: ['Inter'],
      byteDelta: 20_000,
      commercialDelta: 0,
    });
    expect(md).toContain('# Font diff');
    expect(md).toContain('## Added (only in B)');
    expect(md).toContain('- Tiempos');
    expect(md).toContain('+19.5 KB');
  });

  it('omits empty diff sections', () => {
    const md = formatFontDiff({
      schemaVersion: '1.0',
      generatedAt: '2026-05-29T00:00:00Z',
      a: { url: 'https://a.com', families: ['Inter'], totalBytes: 30_000, commercialCount: 0, fileCount: 1 },
      b: { url: 'https://b.com', families: ['Inter'], totalBytes: 30_000, commercialCount: 0, fileCount: 1 },
      added: [],
      removed: [],
      shared: ['Inter'],
      byteDelta: 0,
      commercialDelta: 0,
    });
    expect(md).not.toContain('## Added');
    expect(md).not.toContain('## Removed');
    expect(md).toContain('## Shared');
  });
});
