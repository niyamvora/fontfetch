import { describe, expect, it } from 'vitest';
import {
  formatInspectionReport,
  formatAxesInline,
  type InspectionReport,
  type VariationAxis,
} from '../src/inspect/inspect.js';

function baseReport(overrides: Partial<InspectionReport> = {}): InspectionReport {
  return {
    filePath: '/tmp/Inter-Variable.woff2',
    format: 'woff2',
    bytes: 96_768,
    familyName: 'Inter',
    subfamilyName: 'Regular',
    fullName: 'Inter Variable',
    postscriptName: 'Inter-Variable',
    copyright: 'Copyright 2020 The Inter Project Authors',
    designer: 'Rasmus Andersson',
    vendor: 'Rasmus Andersson',
    version: 'Version 3.19',
    glyphCount: 2548,
    unitsPerEm: 2048,
    isVariable: true,
    variationAxes: [
      { tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 },
      { tag: 'slnt', name: 'Slant', min: -10, default: 0, max: 0 },
    ],
    features: ['calt', 'liga', 'dlig', 'ss01', 'ss02', 'cv11', 'tnum'],
    scripts: [],
    license: {
      description: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
      url: 'https://openfontlicense.org',
      isOFL: true,
      hasRFN: false,
    },
    ...overrides,
  };
}

describe('formatInspectionReport', () => {
  it('renders the headline, size, glyph count, and family on separate lines', () => {
    const out = formatInspectionReport(baseReport());
    expect(out).toContain('Inter Variable');
    expect(out).toMatch(/94\.5\s*KB/);
    expect(out).toContain('Glyphs');
    expect(out).toContain('2548');
    expect(out).toContain('Inter');
  });

  it('shows the variable-axis line when isVariable is true', () => {
    const out = formatInspectionReport(baseReport());
    expect(out).toContain('Axes');
    expect(out).toContain('wght 100..900');
    expect(out).toContain('slnt -10..0');
  });

  it('omits the Axes line for static fonts', () => {
    const out = formatInspectionReport(baseReport({ isVariable: false, variationAxes: [] }));
    expect(out).not.toMatch(/^Axes/m);
  });

  it('summarises OFL licences as "OFL"', () => {
    const out = formatInspectionReport(baseReport());
    expect(out).toMatch(/License\s+OFL/);
  });

  it('appends the RFN tag when the OFL clause is present', () => {
    const out = formatInspectionReport(
      baseReport({
        license: {
          description: 'OFL 1.1 with Reserved Font Name "Inter"',
          url: null,
          isOFL: true,
          hasRFN: true,
        },
      }),
    );
    expect(out).toContain('OFL (RFN)');
  });

  it('shows a truncated first line of the licence description for non-OFL fonts', () => {
    const out = formatInspectionReport(
      baseReport({
        license: {
          description: 'Adobe Fonts subscription. Not redistributable.',
          url: null,
          isOFL: false,
          hasRFN: false,
        },
      }),
    );
    expect(out).toContain('Adobe Fonts subscription');
  });

  it('falls back to "unknown" when no licence info exists', () => {
    const out = formatInspectionReport(
      baseReport({ license: { description: null, url: null, isOFL: false, hasRFN: false } }),
    );
    expect(out).toMatch(/License\s+unknown/);
  });

  it('caps the features line and shows the overflow count', () => {
    const features = Array.from({ length: 24 }, (_, i) => `f${String(i).padStart(2, '0')}`);
    const out = formatInspectionReport(baseReport({ features }));
    expect(out).toContain('+8'); // 24 total - 16 shown
  });
});

describe('formatAxesInline', () => {
  it('renders a normal axis as `tag min..max`', () => {
    const axes: VariationAxis[] = [
      { tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 },
    ];
    expect(formatAxesInline(axes)).toBe('wght 100..900');
  });

  it('collapses a static axis (min === max) to a single value', () => {
    const axes: VariationAxis[] = [
      { tag: 'slnt', name: 'Slant', min: 0, default: 0, max: 0 },
    ];
    expect(formatAxesInline(axes)).toBe('slnt 0');
  });

  it('joins multiple axes with a comma', () => {
    const axes: VariationAxis[] = [
      { tag: 'wght', name: 'Weight', min: 300, default: 400, max: 900 },
      { tag: 'ital', name: 'Italic', min: 0, default: 0, max: 10 },
    ];
    expect(formatAxesInline(axes)).toBe('wght 300..900, ital 0..10');
  });

  it('returns an empty string for an empty axis list', () => {
    expect(formatAxesInline([])).toBe('');
  });
});
