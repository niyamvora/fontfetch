import fs from 'node:fs/promises';
import path from 'node:path';
import { extractStylesheetLinks, extractInlineStyles, extractFontFaces } from './parse.js';
import { buildFontsCss, buildFontsJson, buildReadme, buildLicenseReview } from './emit.js';
import { classifyFaces, summarize } from './license.js';
import { fetchText, fetchBuffer, siteSlug, safeFilename, log } from './utils.js';
import type { CssSource, OrphanFile, PullOptions, PullResult } from './types.js';
import { FONT_EXT_RE } from './utils.js';
import { abs } from './utils.js';
import { fetchHeadless } from './headless.js';
import { EMITTERS } from './emitters/index.js';
import { bucketForUrl } from './provenance.js';

export async function pull({
  url,
  baseDir,
  headless = false,
  emit = [],
  force = false,
  onProgress,
}: PullOptions): Promise<PullResult> {
  const host = siteSlug(url);
  const outDir = path.join(path.resolve(baseDir), host);
  const filesDir = path.join(outDir, 'files');
  await fs.mkdir(filesDir, { recursive: true });

  onProgress?.({ type: 'phase', phase: 'fetch_html' });
  log.info(`→ Fetching page: ${url}`);
  const html = await fetchText(url);

  onProgress?.({ type: 'phase', phase: 'parse_css' });
  const cssLinks = extractStylesheetLinks(html, url);
  const inlineCss = extractInlineStyles(html);
  log.info(`  ${cssLinks.length} external stylesheet(s), ${inlineCss.length} inline <style> block(s)`);

  const cssSources: CssSource[] = inlineCss.map((t) => ({ text: t, base: url }));
  for (const link of cssLinks) {
    try {
      log.info(`→ Fetching CSS: ${link}`);
      cssSources.push({ text: await fetchText(link, { Referer: url }), base: link });
      onProgress?.({ type: 'css_fetched', url: link });
    } catch (e) {
      const reason = (e as Error).message;
      log.warn(`  ! Failed: ${reason}`);
      onProgress?.({ type: 'css_failed', url: link, reason });
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

  const pageHost = new URL(url).hostname;

  // Filenames returned by claim() include the bucket subdir, e.g. "google/Inter-Regular.woff2".
  const urlToLocal = new Map<string, string>();
  const usedNames = new Set<string>();
  const claim = (u: string): string => {
    if (urlToLocal.has(u)) return urlToLocal.get(u)!;
    const bucket = bucketForUrl(u, pageHost);
    let name = safeFilename(u);
    const candidate = `${bucket}/${name}`;
    if (usedNames.has(candidate)) {
      const h = new URL(u).hostname.replace(/[^a-z0-9]/gi, '_');
      name = `${h}__${name}`;
    }
    const final = `${bucket}/${name}`;
    usedNames.add(final);
    urlToLocal.set(u, final);
    return final;
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
    for (const o of orphans) onProgress?.({ type: 'orphan', url: o.url, file: o.file });
  }

  onProgress?.({ type: 'phase', phase: 'extract_faces' });
  onProgress?.({ type: 'faces_found', count: faces.length, files: urlToLocal.size });
  log.info(`→ Found ${faces.length} @font-face declaration(s), ${urlToLocal.size} unique file(s)`);
  if (urlToLocal.size === 0) {
    log.info('  (Nothing to download. Site may load fonts via JS, or block automated requests. Try --headless.)');
    onProgress?.({ type: 'done', downloaded: 0, total: 0, outDir });
    return { outDir, faces, orphans: [], downloaded: 0, total: 0 };
  }

  onProgress?.({ type: 'phase', phase: 'classify' });
  const classified = classifyFaces(faces);
  const licenseSummary = summarize(classified);
  log.info(
    `→ License review: ${licenseSummary.open} open / ${licenseSummary.commercial} commercial / ${licenseSummary.unknown} unknown`,
  );
  onProgress?.({
    type: 'classified',
    open: licenseSummary.open,
    commercial: licenseSummary.commercial,
    unknown: licenseSummary.unknown,
  });

  // Fail-fast: every face came from a commercial foundry CDN. Most users will
  // not have a license for these; download them anyway only if --force is set.
  if (licenseSummary.allCommercial && !force) {
    await fs.writeFile(
      path.join(outDir, 'LICENSE_REVIEW.md'),
      buildLicenseReview(host, classified, licenseSummary),
    );
    log.warn('');
    log.warn(`✗ All ${licenseSummary.commercial} detected font(s) are served from known commercial CDNs.`);
    log.warn('  Downloading and shipping these without a license violates foundry EULAs.');
    log.warn(`  Wrote ${path.join(outDir, 'LICENSE_REVIEW.md')} with the breakdown.`);
    log.warn('  To download anyway (e.g. for a local mockup you have rights to), re-run with --force.');
    log.warn('');
    onProgress?.({ type: 'aborted_all_commercial', count: licenseSummary.commercial });
    onProgress?.({ type: 'done', downloaded: 0, total: urlToLocal.size, outDir });
    return { outDir, faces, orphans: [], downloaded: 0, total: urlToLocal.size };
  }

  onProgress?.({ type: 'phase', phase: 'download' });
  const total = urlToLocal.size;
  let downloaded = 0;
  let index = 0;
  const createdBuckets = new Set<string>();
  for (const [fontUrl, name] of urlToLocal) {
    index++;
    const dest = path.join(filesDir, name);
    const bucketDir = path.dirname(dest);
    if (!createdBuckets.has(bucketDir)) {
      await fs.mkdir(bucketDir, { recursive: true });
      createdBuckets.add(bucketDir);
    }
    try {
      const buf = await fetchBuffer(fontUrl, { Referer: url });
      await fs.writeFile(dest, buf);
      log.info(`  ✓ ${name}  (${buf.length.toLocaleString()} bytes)`);
      const bucket = name.includes('/') ? name.split('/')[0] : 'self-hosted';
      onProgress?.({
        type: 'file_downloaded',
        name,
        bucket,
        bytes: buf.length,
        index,
        total,
      });
      downloaded++;
    } catch (e) {
      const reason = (e as Error).message;
      log.warn(`  ✗ ${name} — ${reason}`);
      onProgress?.({ type: 'file_failed', name, reason });
    }
  }

  await fs.writeFile(path.join(outDir, 'fonts.css'), buildFontsCss(faces));
  await fs.writeFile(path.join(outDir, 'fonts.json'), buildFontsJson(faces, orphans));
  await fs.writeFile(path.join(outDir, 'README.md'), buildReadme(host, faces, downloaded, orphans));
  await fs.writeFile(
    path.join(outDir, 'LICENSE_REVIEW.md'),
    buildLicenseReview(host, classified, licenseSummary),
  );

  for (const target of emit) {
    const emitter = EMITTERS[target];
    if (!emitter) continue;
    const output = emitter(faces, { siteSlug: host, filesDir: 'files' });
    if (!output) continue;
    await fs.writeFile(path.join(outDir, output.filename), output.content);
    log.info(`  + emitted ${output.filename} (--emit ${target})`);
  }

  onProgress?.({ type: 'phase', phase: 'done' });
  onProgress?.({ type: 'done', downloaded, total: urlToLocal.size, outDir });
  return { outDir, faces, orphans, downloaded, total: urlToLocal.size };
}
