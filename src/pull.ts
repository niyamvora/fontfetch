import fs from 'node:fs/promises';
import path from 'node:path';
import { extractStylesheetLinks, extractInlineStyles, extractFontFaces } from './parse.js';
import { buildFontsCss, buildFontsJson, buildReadme } from './emit.js';
import { fetchText, fetchBuffer, siteSlug, safeFilename, log } from './utils.js';
import type { CssSource, PullOptions, PullResult } from './types.js';
import { FONT_EXT_RE } from './utils.js';
import { abs } from './utils.js';

export async function pull({ url, baseDir }: PullOptions): Promise<PullResult> {
  const host = siteSlug(url);
  const outDir = path.join(path.resolve(baseDir), host);
  const filesDir = path.join(outDir, 'files');
  await fs.mkdir(filesDir, { recursive: true });

  log.info(`→ Fetching page: ${url}`);
  const html = await fetchText(url);

  const cssLinks = extractStylesheetLinks(html, url);
  const inlineCss = extractInlineStyles(html);
  log.info(`  ${cssLinks.length} external stylesheet(s), ${inlineCss.length} inline <style> block(s)`);

  const cssSources: CssSource[] = inlineCss.map((t) => ({ text: t, base: url }));
  for (const link of cssLinks) {
    try {
      log.info(`→ Fetching CSS: ${link}`);
      cssSources.push({ text: await fetchText(link, { Referer: url }), base: link });
    } catch (e) {
      log.warn(`  ! Failed: ${(e as Error).message}`);
    }
  }

  const faces = cssSources.flatMap(({ text, base }) => extractFontFaces(text, base));

  // Also catch <link rel="preload" as="font">
  const preloadRe = /<link\b[^>]*rel=["']?preload["']?[^>]*as=["']?font["']?[^>]*>/gi;
  const extraUrls: string[] = [];
  for (const m of html.matchAll(preloadRe)) {
    const href = /href=["']([^"']+)["']/i.exec(m[0])?.[1];
    if (href) {
      const u = abs(href, url);
      if (u && FONT_EXT_RE.test(u)) extraUrls.push(u);
    }
  }

  const urlToLocal = new Map<string, string>();
  const usedNames = new Set<string>();
  const claim = (u: string): string => {
    if (urlToLocal.has(u)) return urlToLocal.get(u)!;
    let name = safeFilename(u);
    if (usedNames.has(name)) {
      const h = new URL(u).hostname.replace(/[^a-z0-9]/gi, '_');
      name = `${h}__${name}`;
    }
    usedNames.add(name);
    urlToLocal.set(u, name);
    return name;
  };

  for (const f of faces) {
    for (const s of f.sources) s.localFile = claim(s.url);
  }
  for (const u of extraUrls) claim(u);

  log.info(`→ Found ${faces.length} @font-face declaration(s), ${urlToLocal.size} unique file(s)`);
  if (urlToLocal.size === 0) {
    log.info('  (Nothing to download. Site may load fonts via JS, or block scrapers.)');
    return { outDir, faces, downloaded: 0, total: 0 };
  }

  let downloaded = 0;
  for (const [fontUrl, name] of urlToLocal) {
    const dest = path.join(filesDir, name);
    try {
      const buf = await fetchBuffer(fontUrl);
      await fs.writeFile(dest, buf);
      log.info(`  ✓ ${name}  (${buf.length.toLocaleString()} bytes)`);
      downloaded++;
    } catch (e) {
      log.warn(`  ✗ ${name} — ${(e as Error).message}`);
    }
  }

  await fs.writeFile(path.join(outDir, 'fonts.css'), buildFontsCss(faces));
  await fs.writeFile(path.join(outDir, 'fonts.json'), buildFontsJson(faces));
  await fs.writeFile(path.join(outDir, 'README.md'), buildReadme(host, faces, downloaded));

  return { outDir, faces, downloaded, total: urlToLocal.size };
}
