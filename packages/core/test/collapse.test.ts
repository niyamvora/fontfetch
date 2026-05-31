import { describe, expect, it } from 'vitest';
import { detectCollapseOpportunities, formatCollapseHint } from '../src/inspect/collapse.js';
import type { FontFace } from '../src/types.js';
import type { VariableFontSummary } from '../src/inspect/inspect.js';

function face(family: string, localFile: string, weight = '400', style = 'normal'): FontFace {
  return {
    family,
    weight,
    style,
    display: null,
    unicodeRange: null,
    sources: [{ url: `https://cdn.example.com/${localFile}`, format: 'woff2', localFile }],
  };
}

const interVariable: VariableFontSummary = {
  family: 'Inter',
  filePath: '/files/google/Inter-Variable.woff2',
  axes: [
    { tag: 'wght', name: 'Weight', min: 100, default: 400, max: 900 },
    { tag: 'slnt', name: 'Slant', min: -10, default: 0, max: 0 },
  ],
};

describe('detectCollapseOpportunities', () => {
  it('flags a family with a variable font + 3 statics as a collapse opportunity', () => {
    const faces = [
      face('Inter', 'google/Inter-Variable.woff2'),
      face('Inter', 'google/Inter-Regular.woff2', '400'),
      face('Inter', 'google/Inter-Bold.woff2', '700'),
      face('Inter', 'google/Inter-Black.woff2', '900'),
    ];
    const sizes = new Map([
      ['google/Inter-Variable.woff2', 80_000],
      ['google/Inter-Regular.woff2', 30_000],
      ['google/Inter-Bold.woff2', 32_000],
      ['google/Inter-Black.woff2', 34_000],
    ]);
    const ops = detectCollapseOpportunities([interVariable], faces, sizes);
    expect(ops).toHaveLength(1);
    expect(ops[0].family).toBe('Inter');
    expect(ops[0].staticFiles).toHaveLength(3);
    expect(ops[0].variableBytes).toBe(80_000);
    expect(ops[0].staticBytes).toBe(96_000);
    expect(ops[0].savedBytes).toBe(16_000);
  });

  it('does not flag families with only one static weight', () => {
    const faces = [
      face('Inter', 'google/Inter-Variable.woff2'),
      face('Inter', 'google/Inter-Regular.woff2', '400'),
    ];
    const sizes = new Map([
      ['google/Inter-Variable.woff2', 96_000],
      ['google/Inter-Regular.woff2', 30_000],
    ]);
    expect(detectCollapseOpportunities([interVariable], faces, sizes)).toEqual([]);
  });

  it('skips families where the wght axis is static (min === max)', () => {
    const staticAxis: VariableFontSummary = {
      family: 'X',
      filePath: '/files/X.woff2',
      axes: [{ tag: 'wght', name: 'Weight', min: 400, default: 400, max: 400 }],
    };
    const faces = [
      face('X', 'X.woff2'),
      face('X', 'X-Regular.woff2'),
      face('X', 'X-Bold.woff2', '700'),
    ];
    const sizes = new Map([
      ['X.woff2', 100_000],
      ['X-Regular.woff2', 30_000],
      ['X-Bold.woff2', 32_000],
    ]);
    expect(detectCollapseOpportunities([staticAxis], faces, sizes)).toEqual([]);
  });

  it('only emits opportunities where collapse would actually save bytes', () => {
    const faces = [
      face('Inter', 'google/Inter-Variable.woff2'),
      face('Inter', 'google/Inter-Regular.woff2', '400'),
      face('Inter', 'google/Inter-Bold.woff2', '700'),
    ];
    // Variable is enormous; statics are tiny — no benefit
    const sizes = new Map([
      ['google/Inter-Variable.woff2', 500_000],
      ['google/Inter-Regular.woff2', 10_000],
      ['google/Inter-Bold.woff2', 12_000],
    ]);
    expect(detectCollapseOpportunities([interVariable], faces, sizes)).toEqual([]);
  });

  it('reports an opportunity when collapse saves at least one byte', () => {
    const faces = [
      face('Inter', 'google/Inter-Variable.woff2'),
      face('Inter', 'google/Inter-Regular.woff2', '400'),
      face('Inter', 'google/Inter-Bold.woff2', '700'),
      face('Inter', 'google/Inter-Black.woff2', '900'),
    ];
    const sizes = new Map([
      ['google/Inter-Variable.woff2', 80_000],
      ['google/Inter-Regular.woff2', 30_000],
      ['google/Inter-Bold.woff2', 32_000],
      ['google/Inter-Black.woff2', 34_000],
    ]);
    const ops = detectCollapseOpportunities([interVariable], faces, sizes);
    expect(ops).toHaveLength(1);
    expect(ops[0].savedBytes).toBe(96_000 - 80_000);
  });

  it('ignores subset files (different optimisation pathway)', () => {
    const faces = [
      face('Inter', 'google/Inter-Variable.woff2'),
      face('Inter', 'google/Inter-Regular.subset.woff2'),
      face('Inter', 'google/Inter-Bold.subset.woff2'),
    ];
    const sizes = new Map([
      ['google/Inter-Variable.woff2', 80_000],
      ['google/Inter-Regular.subset.woff2', 10_000],
      ['google/Inter-Bold.subset.woff2', 12_000],
    ]);
    expect(detectCollapseOpportunities([interVariable], faces, sizes)).toEqual([]);
  });
});

describe('formatCollapseHint', () => {
  it('renders a one-liner with the saved KB value', () => {
    const hint = formatCollapseHint({
      family: 'Inter',
      variableFile: '/files/google/Inter-Variable.woff2',
      variableBytes: 80_000,
      staticFiles: [
        { file: 'google/Inter-Regular.woff2', bytes: 30_000, weight: '400', style: 'normal' },
        { file: 'google/Inter-Bold.woff2', bytes: 32_000, weight: '700', style: 'normal' },
      ],
      staticBytes: 62_000,
      savedBytes: 16_000,
    });
    expect(hint).toContain('Inter');
    expect(hint).toContain('2 static weight file');
    expect(hint).toContain('15.6 KB');
  });
});
