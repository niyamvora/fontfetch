import { describe, expect, it } from 'vitest';
import { buildProvenanceJson, type ProvenanceReport } from '../src/emit/emit.js';
import type { ClassifiedFace } from '../src/license/license.js';
import type { FontFace } from '../src/types.js';

function face(family: string, localFile: string, opts: Partial<FontFace> = {}): FontFace {
  return {
    family,
    weight: opts.weight ?? '400',
    style: opts.style ?? 'normal',
    display: opts.display ?? null,
    unicodeRange: opts.unicodeRange ?? null,
    sources: [
      {
        url: `https://cdn.example.com/${localFile}`,
        format: 'woff2',
        localFile,
      },
    ],
  };
}

function classified(
  family: string,
  localFile: string,
  status: 'open' | 'commercial' | 'unknown',
  reason: string,
  opts: { hasRFN?: boolean; faceOpts?: Partial<FontFace> } = {},
): ClassifiedFace {
  return {
    face: face(family, localFile, opts.faceOpts),
    classification: {
      status,
      reason,
      ...(opts.hasRFN ? { hasRFN: true } : {}),
    },
  };
}

function parse(json: string): ProvenanceReport {
  return JSON.parse(json) as ProvenanceReport;
}

describe('buildProvenanceJson', () => {
  it('emits the v1.0 schema with stable top-level shape', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [classified('Inter', 'google/Inter.woff2', 'open', 'Served from Google Fonts')],
      [],
      new Map([['google/Inter.woff2', 32_180]]),
    );
    const report = parse(json);
    expect(report.schemaVersion).toBe('1.0');
    expect(report.host).toBe('example.com');
    expect(report.sourceUrl).toBe('https://example.com');
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.faces).toHaveLength(1);
    expect(report.orphans).toEqual([]);
  });

  it('preserves classification reason, status, and hasRFN per face', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [
        classified('Söhne', 'adobe-typekit/Sohne.woff2', 'commercial', 'Served from Adobe Typekit'),
        classified('Inter', 'google/Inter.woff2', 'open', 'Served from Google Fonts', { hasRFN: true }),
      ],
      [],
      new Map(),
    );
    const report = parse(json);
    expect(report.faces[0].classification.status).toBe('commercial');
    expect(report.faces[0].classification.reason).toBe('Served from Adobe Typekit');
    expect(report.faces[0].classification.hasRFN).toBeUndefined();
    expect(report.faces[1].classification.hasRFN).toBe(true);
  });

  it('attaches bucket + url + bytes per file', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [classified('Inter', 'google/Inter-Regular.woff2', 'open', 'Served from Google Fonts')],
      [],
      new Map([['google/Inter-Regular.woff2', 32_180]]),
    );
    const report = parse(json);
    const file = report.faces[0].files[0];
    expect(file.file).toBe('files/google/Inter-Regular.woff2');
    expect(file.bucket).toBe('google');
    expect(file.url).toBe('https://cdn.example.com/google/Inter-Regular.woff2');
    expect(file.format).toBe('woff2');
    expect(file.bytes).toBe(32_180);
  });

  it('marks bytes as null when the file was not downloaded', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [classified('Inter', 'google/Inter.woff2', 'open', 'Served from Google Fonts')],
      [],
      new Map(),
    );
    const report = parse(json);
    expect(report.faces[0].files[0].bytes).toBeNull();
  });

  it('summarises by status, bucket, and total bytes', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [
        classified('Inter', 'google/Inter.woff2', 'open', 'Served from Google Fonts'),
        classified('Söhne', 'adobe-typekit/Sohne.woff2', 'commercial', 'Served from Adobe Typekit'),
        classified('Mystery', 'self-hosted/Mystery.woff2', 'unknown', 'No matching CDN'),
      ],
      [],
      new Map([
        ['google/Inter.woff2', 30_000],
        ['adobe-typekit/Sohne.woff2', 50_000],
        ['self-hosted/Mystery.woff2', 20_000],
      ]),
    );
    const report = parse(json);
    expect(report.summary.faces).toBe(3);
    expect(report.summary.files).toBe(3);
    expect(report.summary.bytes).toBe(100_000);
    expect(report.summary.byStatus).toEqual({ open: 1, commercial: 1, unknown: 1 });
    expect(report.summary.byBucket).toEqual({
      google: 1,
      'adobe-typekit': 1,
      'self-hosted': 1,
    });
  });

  it('collects families with RFN into a deduped list', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [
        classified('Inter', 'google/Inter-Regular.woff2', 'open', 'Served from Google Fonts', { hasRFN: true }),
        classified('Inter', 'google/Inter-Bold.woff2', 'open', 'Served from Google Fonts', {
          hasRFN: true,
          faceOpts: { weight: '700' },
        }),
        classified('Geist', 'google/Geist.woff2', 'open', 'Served from Google Fonts'),
      ],
      [],
      new Map(),
    );
    const report = parse(json);
    expect(report.summary.familiesWithRFN).toEqual(['Inter']);
  });

  it('counts unique families correctly across multiple weights', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [
        classified('Inter', 'google/Inter-Regular.woff2', 'open', 'Served from Google Fonts'),
        classified('Inter', 'google/Inter-Bold.woff2', 'open', 'Served from Google Fonts', {
          faceOpts: { weight: '700' },
        }),
        classified('Geist', 'google/Geist.woff2', 'open', 'Served from Google Fonts'),
      ],
      [],
      new Map(),
    );
    const report = parse(json);
    expect(report.summary.families).toBe(2);
    expect(report.summary.faces).toBe(3);
  });

  it('includes orphans with their bucket-style path', () => {
    const json = buildProvenanceJson(
      'example.com',
      'https://example.com',
      [],
      [{ url: 'https://typekit.net/x.woff2', file: 'adobe-typekit/x.woff2' }],
      new Map([['adobe-typekit/x.woff2', 18_000]]),
    );
    const report = parse(json);
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0].file).toBe('files/adobe-typekit/x.woff2');
    expect(report.orphans[0].bytes).toBe(18_000);
  });
});
