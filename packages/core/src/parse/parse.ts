import type { FontFace, FontSource } from '../types.js';
import { FONT_EXT_RE, abs } from '../lib/utils.js';

export function extractStylesheetLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const linkRe = /<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi;
  for (const m of html.matchAll(linkRe)) {
    const href = /href=["']([^"']+)["']/i.exec(m[0])?.[1];
    if (href) {
      const u = abs(href, baseUrl);
      if (u) out.push(u);
    }
  }
  return out;
}

export function extractInlineStyles(html: string): string[] {
  const out: string[] = [];
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const m of html.matchAll(styleRe)) out.push(m[1]);
  return out;
}

function parseFontFace(body: string, baseUrl: string): FontFace | null {
  const getProp = (prop: string): string | null => {
    const m = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i').exec(body);
    return m ? m[1].trim() : null;
  };

  const family = (getProp('font-family') || '').replace(/^['"]|['"]$/g, '');
  const weight = getProp('font-weight') || '400';
  const style = getProp('font-style') || 'normal';
  const display = getProp('font-display');
  const unicodeRange = getProp('unicode-range');

  const srcRaw = getProp('src') || '';
  const sources: FontSource[] = [];
  const srcRe =
    /url\(\s*['"]?([^'")]+)['"]?\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/gi;
  for (const m of srcRaw.matchAll(srcRe)) {
    const raw = m[1];
    if (raw.startsWith('data:')) continue;
    if (!FONT_EXT_RE.test(raw)) continue;
    const absUrl = abs(raw, baseUrl);
    if (!absUrl) continue;
    sources.push({ url: absUrl, format: m[2] || null });
  }

  if (!family || sources.length === 0) return null;
  return { family, weight, style, display, unicodeRange, sources };
}

export function extractFontFaces(css: string, baseUrl: string): FontFace[] {
  const out: FontFace[] = [];
  const faceRe = /@font-face\s*\{([^}]*)\}/gi;
  for (const m of css.matchAll(faceRe)) {
    const parsed = parseFontFace(m[1], baseUrl);
    if (parsed) out.push(parsed);
  }
  return out;
}
