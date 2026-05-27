import fs from 'node:fs/promises';
import path from 'node:path';
import { extractStylesheetLinks, extractInlineStyles, extractFontFaces } from './parse.js';
import { buildFontsCss, buildFontsJson, buildReadme } from './emit.js';
import { fetchText, fetchBuffer, siteSlug, safeFilename, log } from './utils.js';
import type { CssSource, OrphanFile, PullOptions, PullResult } from './types.js';
import { FONT_EXT_RE } from './utils.js';
import { abs } from './utils.js';
import { fetchHeadless } from './headless.js';

export async function pull({ url, baseDir, headless = false }: PullOptions): Promise<PullResult> {
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

  let networkFontUrls: string[] = [];
  if (headless) {
    log.info('→ Running headless mode (Playwright)...');
    try {
      const result = await fetchHeadless(url);
      cssSources.push(...result.cssSources);
      networkFontUrls = result.networkFontUrls;
      log.info(`  + ${result.cssSources.length} stylesheet block(s) from headless`);
      if (networkFontUrls.length > 0) {
        log.info(`  + ${networkFontUrls.length} font URL(s) observed in network`);
      }
    } catch (e) {
      log.warn(`  ! Headless mode failed: ${(e as Error).message}`);
      log.warn('  Continuing with static results.');
    }
  }

  const allFaces = cssSources.flatMap(({ text, base }) => extractFontFaces(text, base));
  // Dedupe across static + headless sources (same rule can appear in both).
  const seen = new Set<string>();
  const faces = allFaces.filter((f) => {
    const sig = `${f.family}|${f.weight}|${f.style}|${f.sources.map((s) => s.url).sort().join(',')}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

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

  // Orphans: font URLs observed in the network log that aren't referenced by any
  // parsed @font-face source. Usually from cross-origin stylesheets whose cssRules
  // we can't read (e.g. Typekit). We download them but can't emit @font-face for
  // them — no family/weight/style metadata.
  const faceUrls = new Set<string>();
  for (const f of faces) for (const s of f.sources) faceUrls.add(s.url);
  const orphans: OrphanFile[] = [];
  for (const u of networkFontUrls) {
    if (faceUrls.has(u)) continue;
    if (urlToLocal.has(u)) continue;
    const file = claim(u);
    orphans.push({ url: u, file });
  }
  if (orphans.length > 0) {
    log.info(`→ ${orphans.length} orphan file(s) (cross-origin, no @font-face metadata available)`);
  }

  log.info(`→ Found ${faces.length} @font-face declaration(s), ${urlToLocal.size} unique file(s)`);
  if (urlToLocal.size === 0) {
    log.info('  (Nothing to download. Site may load fonts via JS, or block automated requests. Try --headless.)');
    return { outDir, faces, orphans: [], downloaded: 0, total: 0 };
  }

  let downloaded = 0;
  for (const [fontUrl, name] of urlToLocal) {
    const dest = path.join(filesDir, name);
    try {
      const buf = await fetchBuffer(fontUrl, { Referer: url });
      await fs.writeFile(dest, buf);
      log.info(`  ✓ ${name}  (${buf.length.toLocaleString()} bytes)`);
      downloaded++;
    } catch (e) {
      log.warn(`  ✗ ${name} — ${(e as Error).message}`);
    }
  }

  await fs.writeFile(path.join(outDir, 'fonts.css'), buildFontsCss(faces));
  await fs.writeFile(path.join(outDir, 'fonts.json'), buildFontsJson(faces, orphans));
  await fs.writeFile(path.join(outDir, 'README.md'), buildReadme(host, faces, downloaded, orphans));

  return { outDir, faces, orphans, downloaded, total: urlToLocal.size };
}
