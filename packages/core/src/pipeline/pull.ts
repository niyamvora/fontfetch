import fs from 'node:fs/promises';
import path from 'node:path';
import { extractStylesheetLinks, extractInlineStyles, extractFontFaces } from '../parse/parse.js';
import { buildFontsCss, buildFontsJson, buildReadme, buildLicenseReview, buildPreloadHints, buildProvenanceJson } from '../emit/emit.js';
import { classifyFaces, summarize } from '../license/license.js';
import { crossRefLicenseFromBinaries } from '../license/binary-license.js';
import { fetchText, fetchBuffer, siteSlug, safeFilename, log } from '../lib/utils.js';
import type { CssSource, OrphanFile, PullOptions, PullResult } from '../types.js';
import { FONT_EXT_RE } from '../lib/utils.js';
import { abs } from '../lib/utils.js';
import { fetchHeadless } from '../headless.js';
import { EMITTERS } from '../emit/emitters/index.js';
import { bucketForUrl } from '../license/provenance.js';
import { buildPerFaceFallbacks } from '../inspect/fallback.js';
import { discoverInternalLinks, CRAWL_PAGE_CAP } from '../parse/crawl.js';
import { buildPageFaceMap, computeConsistency, buildConsistencyReport } from '../parse/consistency.js';
import { isNextjsSubsetUrl, probeNextjsSiblings } from '../platforms/nextjs.js';
import { summarizeVariableFonts, formatAxesInline } from '../inspect/inspect.js';
import { filterFacesByFormat, urlMatchesFormat } from '../formats/formats.js';

interface FetchedPage {
  url: string;
  html: string;
}

export async function pull({
  url,
  baseDir,
  headless = false,
  emit = [],
  force = false,
  onProgress,
  fallback = false,
  pages = 1,
  formats,
}: PullOptions): Promise<PullResult> {
  const host = siteSlug(url);
  const outDir = path.join(path.resolve(baseDir), host);
  const filesDir = path.join(outDir, 'files');
  await fs.mkdir(filesDir, { recursive: true });

  const cappedPages = Math.max(1, Math.min(Math.floor(pages), CRAWL_PAGE_CAP));

  onProgress?.({ type: 'phase', phase: 'fetch_html' });
  log.info(`→ Fetching page: ${url}`);
  const entryHtml = await fetchText(url);
  const fetchedPages: FetchedPage[] = [{ url, html: entryHtml }];

  if (cappedPages > 1) {
    onProgress?.({ type: 'phase', phase: 'crawl' });
    const candidates = discoverInternalLinks(entryHtml, url, { max: cappedPages - 1 });
    log.info(`→ Crawling up to ${cappedPages - 1} additional page(s) (${candidates.length} candidate link(s))`);
    let crawlIndex = 1;
    for (const link of candidates) {
      crawlIndex++;
      try {
        const subHtml = await fetchText(link, { Referer: url });
        fetchedPages.push({ url: link, html: subHtml });
        log.info(`  ✓ ${link}`);
        onProgress?.({ type: 'page_fetched', url: link, index: crawlIndex, total: cappedPages });
      } catch (e) {
        const reason = (e as Error).message;
        log.warn(`  ✗ ${link} — ${reason}`);
        onProgress?.({ type: 'page_failed', url: link, reason });
      }
    }
  }

  onProgress?.({ type: 'phase', phase: 'parse_css' });
  const cssSources: CssSource[] = [];
  // v1.4: per-source page-of-origin index, parallel to cssSources. Used to
  // attribute faces back to the page they came from for CONSISTENCY.md.
  // Sources from headless mode get pageIdx = 0 (entry page).
  const sourceToPage: number[] = [];
  const cssLinkSet = new Set<string>();
  const perPage: { page: FetchedPage; uniqueLinks: string[]; inline: string[] }[] = [];
  let totalInline = 0;
  for (const page of fetchedPages) {
    const links = extractStylesheetLinks(page.html, page.url);
    const uniqueLinks: string[] = [];
    for (const link of links) {
      if (cssLinkSet.has(link)) continue;
      cssLinkSet.add(link);
      uniqueLinks.push(link);
    }
    const inline = extractInlineStyles(page.html);
    totalInline += inline.length;
    perPage.push({ page, uniqueLinks, inline });
  }
  log.info(`  ${cssLinkSet.size} external stylesheet(s), ${totalInline} inline <style> block(s)`);

  for (let pageIdx = 0; pageIdx < perPage.length; pageIdx++) {
    const { page, uniqueLinks, inline } = perPage[pageIdx];
    for (const text of inline) {
      cssSources.push({ text, base: page.url });
      sourceToPage.push(pageIdx);
    }
    for (const link of uniqueLinks) {
      try {
        log.info(`→ Fetching CSS: ${link}`);
        cssSources.push({ text: await fetchText(link, { Referer: page.url }), base: link });
        sourceToPage.push(pageIdx);
        onProgress?.({ type: 'css_fetched', url: link });
      } catch (e) {
        const reason = (e as Error).message;
        log.warn(`  ! Failed: ${reason}`);
        onProgress?.({ type: 'css_failed', url: link, reason });
      }
    }
  }

  let networkFontUrls: string[] = [];
  if (headless) {
    log.info('→ Running headless mode (Playwright)...');
    try {
      const result = await fetchHeadless(url);
      for (const src of result.cssSources) {
        cssSources.push(src);
        // Headless sources are attributed to the entry page (pageIdx 0) for
        // consistency reporting — the headless pass only runs on the entry URL.
        sourceToPage.push(0);
      }
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

  // v1.4: extract per-source so we can attribute faces back to their page-of-origin
  // for the cross-page consistency report. Flatten right after.
  const facesPerSource = cssSources.map(({ text, base }) => extractFontFaces(text, base));
  const allFaces = facesPerSource.flat();
  // Dedupe across static + headless sources (same rule can appear in both).
  const seen = new Set<string>();
  const dedupedFaces = allFaces.filter((f) => {
    const sig = `${f.family}|${f.weight}|${f.style}|${f.sources.map((s) => s.url).sort().join(',')}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  // Format filter (--formats=woff2 closes glyphhanger #8). Each face's
  // sources list is narrowed to the allowed formats; faces with zero
  // surviving sources are dropped with a warning so the rest of the pipeline
  // never sees a face it can't emit. No filter applied when `formats` is
  // unset or empty — that's the v1.2 default.
  let faces = dedupedFaces;
  if (formats && formats.length > 0) {
    const result = filterFacesByFormat(dedupedFaces, formats);
    faces = result.kept;
    if (result.dropped.length > 0) {
      log.warn(
        `  ! ${result.dropped.length} face(s) dropped — no ${formats.join('/')} source available`,
      );
    }
    log.info(`→ Format filter: keeping ${formats.join(', ')} (${faces.length}/${dedupedFaces.length} faces)`);
  }

  // Also catch <link rel="preload" as="font">
  const preloadRe = /<link\b[^>]*rel=["']?preload["']?[^>]*as=["']?font["']?[^>]*>/gi;
  const extraUrls: string[] = [];
  for (const page of fetchedPages) {
    for (const m of page.html.matchAll(preloadRe)) {
      const href = /href=["']([^"']+)["']/i.exec(m[0])?.[1];
      if (href) {
        const u = abs(href, page.url);
        if (u && FONT_EXT_RE.test(u)) {
          // Honor the format allowlist for preload URLs too — otherwise --formats=woff2
          // would still pull woff/ttf preloads that fontfetch then can't reference.
          if (formats && formats.length > 0 && !urlMatchesFormat(u, formats)) continue;
          extraUrls.push(u);
        }
      }
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

  // Next.js next/font subset sibling enumeration. For each URL matching the
  // `/_next/static/media/<hash>-s.<letter>.woff2` pattern we already have,
  // probe the alphabet of sibling letters via HEAD and claim the responders.
  // This catches the "1 file shown but family ships 8 unicode subsets" trap.
  const discoveredNextjsSiblings: string[] = [];
  const seedUrls = [...urlToLocal.keys()];
  const probeSeeds = seedUrls.filter(isNextjsSubsetUrl);
  if (probeSeeds.length > 0) {
    onProgress?.({ type: 'phase', phase: 'probe_nextjs' });
    log.info(`→ Probing Next.js subset siblings for ${probeSeeds.length} URL(s)`);
    for (const seed of probeSeeds) {
      const siblings = await probeNextjsSiblings(seed, { Referer: url });
      const fresh = siblings.filter((s) => !urlToLocal.has(s));
      for (const s of fresh) {
        claim(s);
        discoveredNextjsSiblings.push(s);
      }
      if (fresh.length > 0) {
        log.info(`  + ${fresh.length} Next.js sibling(s) for ${seed}`);
      }
      onProgress?.({ type: 'nextjs_siblings', sourceUrl: seed, discovered: fresh.length });
    }
  }

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
    log.info('');
    log.info('  This is usually fixable. Try one of:');
    if (!headless) {
      log.info('    --headless           (most likely fix: site loads fonts via JS)');
    }
    if (cappedPages === 1) {
      log.info('    --pages=5            (the entry page might not reference all fonts)');
    }
    if (headless && cappedPages > 1) {
      log.info("    Both --headless and --pages are on. If you're still seeing 0 files,");
      log.info('    the site likely loads fonts behind a login or via a non-CSS mechanism.');
    } else {
      log.info("  If the site is behind a login, fontfetch can't help.");
    }
    log.info('');
    onProgress?.({ type: 'empty_help_hinted' });
    onProgress?.({ type: 'done', downloaded: 0, total: 0, outDir });
    return {
      outDir,
      faces,
      orphans: [],
      downloaded: 0,
      total: 0,
      variableFonts: [],
      pagesCrawled: fetchedPages.length,
      discoveredNextjsSiblings,
    };
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
    return {
      outDir,
      faces,
      orphans: [],
      downloaded: 0,
      total: urlToLocal.size,
      variableFonts: [],
      pagesCrawled: fetchedPages.length,
      discoveredNextjsSiblings,
    };
  }

  onProgress?.({ type: 'phase', phase: 'download' });
  const total = urlToLocal.size;
  let downloaded = 0;
  let index = 0;
  const createdBuckets = new Set<string>();
  const fileSizes = new Map<string, number>();
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
      fileSizes.set(name, buf.length);
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

  // v1.3.1: cross-reference each classified face against its downloaded
  // binary's OpenType `name` table. URL-signature commercials are never
  // demoted; `unknown` faces whose binary self-declares OFL get promoted to
  // `open`; RFN flags get surfaced in LICENSE_REVIEW.md regardless of
  // origin classification.
  const refined = await crossRefLicenseFromBinaries(classified, filesDir);
  const refinedSummary = summarize(refined);
  const refinedRfnCount = refined.filter((c) => c.classification.hasRFN).length;
  if (refinedSummary.open !== licenseSummary.open || refinedRfnCount > 0) {
    log.info(
      `→ License review (binary cross-ref): ${refinedSummary.open} open / ${refinedSummary.commercial} commercial / ${refinedSummary.unknown} unknown` +
        (refinedRfnCount > 0 ? ` (${refinedRfnCount} OFL family with RFN clause)` : ''),
    );
  }

  // Variable-font surfacing. Inspect each downloaded binary for variation
  // axes; if any are present, surface a one-liner so the user knows their
  // single file is actually the whole family. Non-fatal.
  onProgress?.({ type: 'phase', phase: 'inspect_variable' });
  const variableFonts = await summarizeVariableFonts(filesDir);
  if (variableFonts.length > 0) {
    const subject =
      variableFonts.length === 1
        ? `One variable font detected: ${variableFonts[0].family} (${formatAxesInline(variableFonts[0].axes)})`
        : `${variableFonts.length} variable fonts detected:`;
    log.info(`  ℹ ${subject}`);
    if (variableFonts.length === 1) {
      log.info('    All weights and italic styles live in this single binary.');
    } else {
      for (const vf of variableFonts) {
        log.info(`    • ${vf.family} (${formatAxesInline(vf.axes)})`);
      }
      log.info('    Every weight/italic of each family lives in its single binary.');
    }
    onProgress?.({ type: 'variable_fonts', fonts: variableFonts });
  }

  let fallbackBlocks: string[] = [];
  if (fallback) {
    log.info('→ Computing CLS-killing fallback metrics (capsize, per weight)');
    const { css, count, errors } = await buildPerFaceFallbacks(filesDir, faces);
    if (count > 0) {
      fallbackBlocks = [css];
      log.info(`  + ${count} fallback @font-face block(s) generated (one per weight/style)`);
    }
    for (const err of errors) {
      log.warn(`  ! fallback skipped for ${path.basename(err.file)}: ${err.reason}`);
    }
  }

  const preloadHints = buildPreloadHints(faces);
  await fs.writeFile(
    path.join(outDir, 'fonts.css'),
    buildFontsCss(faces, { preloadHints, extraBlocks: fallbackBlocks }),
  );
  await fs.writeFile(path.join(outDir, 'fonts.json'), buildFontsJson(faces, orphans));
  await fs.writeFile(path.join(outDir, 'README.md'), buildReadme(host, faces, downloaded, orphans));
  await fs.writeFile(
    path.join(outDir, 'LICENSE_REVIEW.md'),
    buildLicenseReview(host, refined, refinedSummary),
  );
  // v1.4: machine-readable counterpart to LICENSE_REVIEW.md + the v0.6
  // provenance buckets. Consumed by `fontfetch audit`, the GH Action, and
  // any external CI / design-system tooling.
  await fs.writeFile(
    path.join(outDir, 'provenance.json'),
    buildProvenanceJson(host, url, refined, orphans, fileSizes),
  );
  // v1.4: cross-page consistency report. Only meaningful when --pages > 1;
  // for a single-page pull every face is on the entry page by definition.
  let consistencyReport: ReturnType<typeof computeConsistency> | undefined;
  if (fetchedPages.length > 1) {
    const pageUrls = fetchedPages.map((p) => p.url);
    const pageFaceMap = buildPageFaceMap(pageUrls, sourceToPage, facesPerSource);
    consistencyReport = computeConsistency(pageFaceMap);
    await fs.writeFile(
      path.join(outDir, 'CONSISTENCY.md'),
      buildConsistencyReport(consistencyReport, host),
    );
    if (consistencyReport.divergent.length > 0) {
      log.info(
        `→ Cross-page consistency: ${consistencyReport.shared.length} shared / ${consistencyReport.divergent.length} divergent page(s) — see CONSISTENCY.md`,
      );
    } else {
      log.info(
        `→ Cross-page consistency: ${consistencyReport.shared.length} family/families used on every crawled page`,
      );
    }
  }

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
  return {
    outDir,
    faces,
    orphans,
    downloaded,
    total: urlToLocal.size,
    variableFonts,
    pagesCrawled: fetchedPages.length,
    discoveredNextjsSiblings,
    ...(consistencyReport ? { consistency: consistencyReport } : {}),
    fileSizes: Object.fromEntries(fileSizes),
  };
}
