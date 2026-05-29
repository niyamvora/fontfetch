import { describe, expect, it } from 'vitest';
import { buildGdprReport, formatGdprMarkdown } from '../src/emit/gdpr.js';
import type { FontFace } from '../src/types.js';

function face(family: string, sourceUrl: string): FontFace {
  return {
    family,
    weight: '400',
    style: 'normal',
    display: null,
    unicodeRange: null,
    sources: [{ url: sourceUrl, format: 'woff2' }],
  };
}

describe('buildGdprReport', () => {
  it('flags Google Fonts CDN as high severity', () => {
    const report = buildGdprReport('example.com', 'https://example.com', [
      face('Inter', 'https://fonts.gstatic.com/s/inter/v1/x.woff2'),
    ]);
    expect(report.findings[0].bucket).toBe('google');
    expect(report.findings[0].severity).toBe('high');
    expect(report.summary.highSeverity).toBe(1);
    expect(report.summary.thirdParty).toBe(1);
  });

  it('flags Adobe Typekit as high severity', () => {
    const report = buildGdprReport('example.com', 'https://example.com', [
      face('Söhne', 'https://use.typekit.net/abc/sohne.woff2'),
    ]);
    expect(report.findings[0].bucket).toBe('adobe-typekit');
    expect(report.findings[0].severity).toBe('high');
  });

  it('flags open CDNs as medium severity', () => {
    const report = buildGdprReport('example.com', 'https://example.com', [
      face('Inter', 'https://rsms.me/inter/font-files/Inter.woff2'),
    ]);
    expect(report.findings[0].bucket).toBe('open-cdn');
    expect(report.findings[0].severity).toBe('medium');
  });

  it('marks self-hosted as low severity (no remediation needed)', () => {
    const report = buildGdprReport('example.com', 'https://example.com', [
      face('Inter', 'https://example.com/fonts/inter.woff2'),
    ]);
    expect(report.findings[0].bucket).toBe('self-hosted');
    expect(report.findings[0].severity).toBe('low');
    expect(report.summary.selfHosted).toBe(1);
    expect(report.summary.thirdParty).toBe(0);
  });

  it('dedupes findings with the same family + bucket + url', () => {
    const report = buildGdprReport('example.com', 'https://example.com', [
      face('Inter', 'https://fonts.gstatic.com/s/inter/v1/x.woff2'),
      face('Inter', 'https://fonts.gstatic.com/s/inter/v1/x.woff2'),
    ]);
    expect(report.findings).toHaveLength(1);
  });

  it('emits the stable v1.0 schema shape', () => {
    const report = buildGdprReport('example.com', 'https://example.com', [
      face('Inter', 'https://fonts.gstatic.com/s/inter/v1/x.woff2'),
    ]);
    expect(report.schemaVersion).toBe('1.0');
    expect(report.host).toBe('example.com');
    expect(report.sourceUrl).toBe('https://example.com');
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('formatGdprMarkdown', () => {
  it('renders the clean-bill-of-health case when no third-party requests exist', () => {
    const md = formatGdprMarkdown(
      buildGdprReport('example.com', 'https://example.com', [
        face('Inter', 'https://example.com/fonts/inter.woff2'),
      ]),
    );
    expect(md).toContain('No third-party font requests detected');
  });

  it('lists findings grouped by bucket with severity icons', () => {
    const md = formatGdprMarkdown(
      buildGdprReport('example.com', 'https://example.com', [
        face('Inter', 'https://fonts.gstatic.com/s/inter/v1/x.woff2'),
        face('Söhne', 'https://use.typekit.net/abc/sohne.woff2'),
      ]),
    );
    expect(md).toContain('Google Fonts CDN');
    expect(md).toContain('Adobe Fonts / Typekit');
    expect(md).toContain('**Inter**');
    expect(md).toContain('**Söhne**');
    expect(md).toContain('🔴'); // high severity
  });

  it('cites the LG München precedent in the disclaimer', () => {
    const md = formatGdprMarkdown(
      buildGdprReport('example.com', 'https://example.com', [
        face('Inter', 'https://fonts.gstatic.com/s/inter/v1/x.woff2'),
      ]),
    );
    expect(md).toContain('LG München');
  });
});
