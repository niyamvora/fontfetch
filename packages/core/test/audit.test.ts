import { describe, expect, it, vi } from 'vitest';
import type { FontFace, PullResult } from '../src/types.js';

const pullMock = vi.hoisted(() => vi.fn());

vi.mock('../src/pipeline/pull.js', () => ({ pull: pullMock }));

const { audit, formatAuditReport } = await import('../src/pipeline/audit.js');

function face(
  family: string,
  localFile: string,
  opts: Partial<FontFace> & { sourceUrl?: string } = {},
): FontFace {
  return {
    family,
    weight: opts.weight ?? '400',
    style: opts.style ?? 'normal',
    display: null,
    unicodeRange: null,
    sources: [
      {
        url: opts.sourceUrl ?? `https://cdn.example.com/${localFile}`,
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

describe('audit', () => {
  it('passes when no rules are configured', async () => {
    pullMock.mockResolvedValueOnce(
      result([face('Inter', 'google/Inter.woff2')], { 'google/Inter.woff2': 30_000 }),
    );
    const report = await audit('https://a.com', '/tmp');
    expect(report.passed).toBe(true);
    expect(report.violations).toEqual([]);
  });

  it('fails when the total bundle exceeds --max-kb', async () => {
    pullMock.mockResolvedValueOnce(
      result(
        [face('Inter', 'google/Inter.woff2'), face('Söhne', 'commercial/Sohne.woff2', { sourceUrl: 'https://fast.fonts.net/x.woff2' })],
        { 'google/Inter.woff2': 60_000, 'commercial/Sohne.woff2': 50_000 },
      ),
    );
    const report = await audit('https://a.com', '/tmp', { maxKb: 100 });
    expect(report.passed).toBe(false);
    expect(report.violations[0].type).toBe('budget_exceeded');
    expect(report.violations[0].detail?.budgetKb).toBe(100);
  });

  it('fails when a per-family budget is exceeded', async () => {
    pullMock.mockResolvedValueOnce(
      result(
        [
          face('Inter', 'google/Inter-Regular.woff2'),
          face('Inter', 'google/Inter-Bold.woff2', { weight: '700' }),
        ],
        { 'google/Inter-Regular.woff2': 30_000, 'google/Inter-Bold.woff2': 32_000 },
      ),
    );
    const report = await audit('https://a.com', '/tmp', { perFamilyKb: { Inter: 50 } });
    expect(report.passed).toBe(false);
    expect(report.violations[0].type).toBe('family_budget_exceeded');
    expect(report.violations[0].detail?.family).toBe('Inter');
  });

  it('fails when --no-commercial is set and a commercial face is present', async () => {
    pullMock.mockResolvedValueOnce(
      result(
        [face('Söhne', 'adobe-typekit/Sohne.woff2', { sourceUrl: 'https://use.typekit.net/abc/sohne.woff2' })],
        { 'adobe-typekit/Sohne.woff2': 50_000 },
      ),
    );
    const report = await audit('https://a.com', '/tmp', { noCommercial: true });
    expect(report.passed).toBe(false);
    expect(report.violations[0].type).toBe('commercial_present');
  });

  it('accumulates multiple violations', async () => {
    pullMock.mockResolvedValueOnce(
      result(
        [face('Söhne', 'adobe-typekit/Sohne.woff2', { sourceUrl: 'https://use.typekit.net/abc/sohne.woff2' })],
        { 'adobe-typekit/Sohne.woff2': 200_000 },
      ),
    );
    const report = await audit('https://a.com', '/tmp', { maxKb: 50, noCommercial: true });
    expect(report.passed).toBe(false);
    expect(report.violations.map((v) => v.type).sort()).toEqual([
      'budget_exceeded',
      'commercial_present',
    ]);
  });

  it('reports per-family bytes in the summary', async () => {
    pullMock.mockResolvedValueOnce(
      result(
        [
          face('Inter', 'google/Inter.woff2'),
          face('Geist', 'google/Geist.woff2'),
        ],
        { 'google/Inter.woff2': 30_000, 'google/Geist.woff2': 25_000 },
      ),
    );
    const report = await audit('https://a.com', '/tmp');
    expect(report.summary.perFamilyBytes).toEqual({ Inter: 30_000, Geist: 25_000 });
  });
});

describe('formatAuditReport', () => {
  it('renders a passing report cleanly', () => {
    const out = formatAuditReport({
      schemaVersion: '1.0',
      generatedAt: '2026-05-29T00:00:00Z',
      url: 'https://a.com',
      passed: true,
      violations: [],
      summary: {
        families: 1,
        faces: 1,
        files: 1,
        totalBytes: 30_000,
        byStatus: { open: 1, commercial: 0, unknown: 0 },
        perFamilyBytes: { Inter: 30_000 },
      },
    });
    expect(out).toContain('✓ Passed');
  });

  it('lists each violation when failing', () => {
    const out = formatAuditReport({
      schemaVersion: '1.0',
      generatedAt: '2026-05-29T00:00:00Z',
      url: 'https://a.com',
      passed: false,
      violations: [
        { type: 'budget_exceeded', message: 'Bundle too big' },
        { type: 'commercial_present', message: '1 commercial face' },
      ],
      summary: {
        families: 1,
        faces: 1,
        files: 1,
        totalBytes: 200_000,
        byStatus: { open: 0, commercial: 1, unknown: 0 },
        perFamilyBytes: {},
      },
    });
    expect(out).toContain('✗ Failed with 2 violation(s)');
    expect(out).toContain('budget_exceeded');
    expect(out).toContain('commercial_present');
  });
});
