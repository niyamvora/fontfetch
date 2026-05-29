import { describe, expect, it } from 'vitest';
import { buildFontsCss, buildPreloadHints, buildLicenseReview } from '../src/emit/emit.js';
import type { ClassifiedFace, LicenseSummary } from '../src/license/license.js';
import type { FontFace } from '../src/types.js';

function face(overrides: Partial<FontFace> & { family: string; localFile: string }): FontFace {
  return {
    family: overrides.family,
    weight: overrides.weight ?? '400',
    style: overrides.style ?? 'normal',
    display: overrides.display ?? null,
    unicodeRange: overrides.unicodeRange ?? null,
    sources: [
      {
        url: `https://cdn.example.com/${overrides.localFile}`,
        format: 'woff2',
        localFile: overrides.localFile,
      },
    ],
  };
}

describe('buildFontsCss — v1.1 defaults', () => {
  it("defaults missing font-display to 'swap' on every face", () => {
    const css = buildFontsCss([face({ family: 'Inter', localFile: 'google/Inter.woff2' })]);
    expect(css).toContain('font-display: swap');
  });

  it('preserves an explicit font-display value when the source rule sets one', () => {
    const css = buildFontsCss([
      face({ family: 'Inter', display: 'optional', localFile: 'google/Inter.woff2' }),
    ]);
    expect(css).toContain('font-display: optional');
    expect(css).not.toContain('font-display: swap');
  });

  it('renders a unicode-range when the source rule has one', () => {
    const css = buildFontsCss([
      face({
        family: 'Inter',
        unicodeRange: 'U+0000-00FF, U+0131',
        localFile: 'google/Inter.woff2',
      }),
    ]);
    expect(css).toContain('unicode-range: U+0000-00FF, U+0131');
  });
});

describe('buildFontsCss — v1.2 extras', () => {
  it('renders preload hints as comments above the @font-face block', () => {
    const css = buildFontsCss([face({ family: 'Inter', localFile: 'google/Inter.woff2' })], {
      preloadHints: [
        '<link rel="preload" href="./files/google/Inter.woff2" as="font" type="font/woff2" crossorigin>',
      ],
    });
    const preloadIdx = css.indexOf('rel="preload"');
    const fontFaceIdx = css.indexOf('@font-face');
    expect(preloadIdx).toBeGreaterThan(-1);
    expect(fontFaceIdx).toBeGreaterThan(preloadIdx);
  });

  it('appends extraBlocks (e.g. fallback faces) after the primary block', () => {
    const css = buildFontsCss([face({ family: 'Inter', localFile: 'google/Inter.woff2' })], {
      extraBlocks: [
        "@font-face {\n  font-family: 'Inter Fallback';\n  src: local('Arial');\n  size-adjust: 107%;\n}",
      ],
    });
    const primaryIdx = css.indexOf("font-family: 'Inter'");
    const fallbackIdx = css.indexOf("font-family: 'Inter Fallback'");
    expect(primaryIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(primaryIdx);
    expect(css).toContain('size-adjust: 107%');
  });
});

describe('buildLicenseReview — v1.3.1 RFN callout', () => {
  function classified(family: string, hasRFN: boolean): ClassifiedFace {
    return {
      face: face({ family, localFile: `google/${family}.woff2` }),
      classification: { status: 'open', reason: 'Served from Google Fonts', hasRFN },
    };
  }

  const summary = (open: number): LicenseSummary => ({
    open,
    commercial: 0,
    unknown: 0,
    total: open,
    allCommercial: false,
  });

  it('renders the OFL RFN warning for families flagged with hasRFN', () => {
    const md = buildLicenseReview('example.com', [classified('Inter', true)], summary(1));
    expect(md).toContain('OFL Reserved Font Name');
    expect(md).toContain('"Inter"');
  });

  it('omits the RFN warning when no faces in the family carry the flag', () => {
    const md = buildLicenseReview('example.com', [classified('Geist', false)], summary(1));
    expect(md).not.toContain('OFL Reserved Font Name');
  });

  it('attaches the RFN warning only to families that have it', () => {
    const md = buildLicenseReview(
      'example.com',
      [classified('Inter', true), classified('Geist', false)],
      summary(2),
    );
    const interIdx = md.indexOf('### Inter');
    const geistIdx = md.indexOf('### Geist');
    const rfnIdx = md.indexOf('OFL Reserved Font Name');
    expect(rfnIdx).toBeGreaterThan(interIdx);
    expect(rfnIdx).toBeLessThan(geistIdx);
  });
});

describe('buildPreloadHints', () => {
  it('emits one <link rel=preload> per primary source, with crossorigin and type', () => {
    const hints = buildPreloadHints([
      face({ family: 'Inter', localFile: 'google/Inter-Regular.woff2' }),
      face({ family: 'Inter', weight: '700', localFile: 'google/Inter-Bold.woff2' }),
    ]);
    expect(hints).toHaveLength(2);
    expect(hints[0]).toContain('rel="preload"');
    expect(hints[0]).toContain('as="font"');
    expect(hints[0]).toContain('type="font/woff2"');
    expect(hints[0]).toContain('crossorigin');
    expect(hints[0]).toContain('./files/google/Inter-Regular.woff2');
  });

  it('dedupes when two faces point at the same primary file', () => {
    const f = face({ family: 'Inter', localFile: 'google/Inter.woff2' });
    expect(buildPreloadHints([f, f])).toHaveLength(1);
  });

  it('skips faces with no localFile (defensive)', () => {
    const f = face({ family: 'Inter', localFile: 'google/Inter.woff2' });
    f.sources[0].localFile = undefined;
    expect(buildPreloadHints([f])).toHaveLength(0);
  });
});
