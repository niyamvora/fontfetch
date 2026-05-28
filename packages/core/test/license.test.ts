import { describe, expect, it } from 'vitest';
import { classifyFace, classifyFaces, summarize } from '../src/license/license.js';
import type { FontFace } from '../src/types.js';

function face(overrides: Partial<FontFace> & { url: string; family: string }): FontFace {
  return {
    family: overrides.family,
    weight: overrides.weight ?? '400',
    style: overrides.style ?? 'normal',
    display: overrides.display ?? null,
    unicodeRange: overrides.unicodeRange ?? null,
    sources: [{ url: overrides.url, format: 'woff2' }],
  };
}

describe('classifyFace — URL signatures', () => {
  it('flags Google Fonts CDN as open', () => {
    const f = face({ family: 'Inter', url: 'https://fonts.gstatic.com/s/inter/v12/...woff2' });
    expect(classifyFace(f).status).toBe('open');
    expect(classifyFace(f).reason).toMatch(/Google Fonts CDN/);
  });

  it('flags Adobe Typekit as commercial', () => {
    const f = face({ family: 'Sohne', url: 'https://use.typekit.net/af/something.woff2' });
    expect(classifyFace(f).status).toBe('commercial');
    expect(classifyFace(f).reason).toMatch(/Adobe Fonts/);
  });

  it('flags Monotype fast.fonts.net as commercial', () => {
    const f = face({ family: 'Helvetica Now', url: 'https://fast.fonts.net/asdf.woff2' });
    expect(classifyFace(f).status).toBe('commercial');
  });

  it('flags Hoefler & Co cloud.typography as commercial', () => {
    const f = face({ family: 'Whitney', url: 'https://cloud.typography.com/abc/123.woff2' });
    expect(classifyFace(f).status).toBe('commercial');
  });

  it('URL signature wins over family-name match (Inter on Typekit = commercial)', () => {
    const f = face({ family: 'Inter', url: 'https://use.typekit.net/af/abc.woff2' });
    expect(classifyFace(f).status).toBe('commercial');
  });
});

describe('classifyFace — family-name fallback', () => {
  it('matches known-open families served from arbitrary CDNs', () => {
    const f = face({ family: 'Geist', url: 'https://example.com/Geist-Regular.woff2' });
    expect(classifyFace(f).status).toBe('open');
    expect(classifyFace(f).reason).toMatch(/SIL OFL/);
  });

  it('case-insensitive family-name match', () => {
    const f = face({ family: 'INTER DISPLAY', url: 'https://example.com/x.woff2' });
    expect(classifyFace(f).status).toBe('open');
  });

  it('returns unknown for an unfamiliar family on a self-hosted CDN', () => {
    const f = face({ family: 'Acme Proprietary', url: 'https://example.com/acme.woff2' });
    expect(classifyFace(f).status).toBe('unknown');
  });
});

describe('summarize', () => {
  it('counts each status correctly', () => {
    const faces = [
      face({ family: 'Inter', url: 'https://fonts.gstatic.com/x.woff2' }),
      face({ family: 'Geist', url: 'https://example.com/g.woff2' }),
      face({ family: 'Sohne', url: 'https://use.typekit.net/a.woff2' }),
      face({ family: 'Acme', url: 'https://example.com/a.woff2' }),
    ];
    const summary = summarize(classifyFaces(faces));
    expect(summary).toEqual({
      open: 2,
      commercial: 1,
      unknown: 1,
      total: 4,
      allCommercial: false,
    });
  });

  it('flags allCommercial=true when every face is commercial', () => {
    const faces = [
      face({ family: 'A', url: 'https://use.typekit.net/a.woff2' }),
      face({ family: 'B', url: 'https://fast.fonts.net/b.woff2' }),
    ];
    const summary = summarize(classifyFaces(faces));
    expect(summary.allCommercial).toBe(true);
  });

  it('allCommercial=false when at least one is open', () => {
    const faces = [
      face({ family: 'A', url: 'https://use.typekit.net/a.woff2' }),
      face({ family: 'Inter', url: 'https://fonts.gstatic.com/i.woff2' }),
    ];
    expect(summarize(classifyFaces(faces)).allCommercial).toBe(false);
  });

  it('allCommercial=false on an empty face list', () => {
    expect(summarize([]).allCommercial).toBe(false);
  });
});
