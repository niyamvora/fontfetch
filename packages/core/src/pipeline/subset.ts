import fs from 'node:fs/promises';
import path from 'node:path';
import * as fontkit from 'fontkit';
import { pull } from './pull.js';
import { log, UA } from '../lib/utils.js';
import {
  GOOGLE_FONTS_RANGES,
  MIN_GLYPHS_PER_BUCKET,
  expandBucket,
  type UnicodeRangeBucket,
} from '../formats/codepoints.js';
import type { PullResult } from '../types.js';

export interface SubsetFileReport {
  file: string;
  originalBytes: number;
  subsetBytes: number;
  saved: number;
  savedPct: number;
  /** Set when this file was produced by `--split-ranges`. */
  bucket?: string;
}

export interface SplitFamilyReport {
  /** Family as parsed from the source binary's name table. */
  family: string;
  /** Source font relative path inside `<outDir>/files/`. */
  sourceFile: string;
  /** One entry per emitted per-bucket subset file. */
  buckets: { bucket: string; file: string; codepoints: number; bytes: number }[];
}

export interface SubsetReport {
  outDir: string;
  url: string;
  uniqueCodepoints: number;
  filesAttempted: number;
  filesSubset: number;
  totalOriginalBytes: number;
  totalSubsetBytes: number;
  totalSavedBytes: number;
  totalSavedPct: number;
  perFile: SubsetFileReport[];
  errors: { file: string; reason: string }[];
  /** Populated when `--split-ranges` is on. One entry per source font that produced at least one bucket file. */
  splits?: SplitFamilyReport[];
  /** Path (under outDir) to the chained `@font-face` CSS emitted when `--split-ranges` is on. */
  splitCss?: string;
}

export interface SubsetOptions {
  url: string;
  baseDir: string;
  /** Override the rendered-DOM glyph set with explicit text (e.g. for an i18n superset). */
  text?: string;
  /** Skip the static-then-headless pull and operate on an existing per-site folder. */
  skipPull?: boolean;
  /** Treat any of these unicode-range subsets as required even if not seen on the page. */
  preserveRanges?: ('latin' | 'latin-ext' | 'cyrillic' | 'greek')[];
  /**
   * Extra codepoints to always include in the subset, on top of whatever the
   * DOM walk produced. Use for dynamic content the static crawl can't see —
   * currency glyphs, breaking-space variants, locale punctuation, icons that
   * load via JS. Mirrors glyphhanger's `--whitelist=U+00A0`. The CLI parses
   * `U+0020-007F, U+00A0` syntax (see `parseUnicodeRange`) before calling.
   */
  whitelist?: number[];
  /**
   * Emit per-language subset files (latin / latin-ext / cyrillic / vietnamese
   * / greek / …) instead of a single `<original>.subset.woff2`. Each emitted
   * file covers the full overlap between the source font's character set and
   * the bucket — same shape Google Fonts serves a multi-script family in.
   *
   * When this is on the DOM scrape is skipped: split-mode is about ranged
   * lazy-loading, not page-content subsetting. The browser will fetch only
   * the buckets it needs at runtime via `unicode-range:` declarations
   * emitted into `fonts.subset.css` alongside the binaries.
   */
  splitRanges?: boolean;
  /**
   * Restrict the split to a named subset of Google Fonts buckets. Default is
   * all buckets in `GOOGLE_FONTS_RANGES`. Ignored when `splitRanges` is off.
   */
  splitBuckets?: string[];
}

const SUBSET_RANGES: Record<NonNullable<SubsetOptions['preserveRanges']>[number], number[]> = {
  latin: [...Array(0x80).keys()],
  'latin-ext': [...Array(0x180 - 0x80).keys()].map((i) => i + 0x80),
  cyrillic: [...Array(0x500 - 0x400).keys()].map((i) => i + 0x400),
  greek: [...Array(0x400 - 0x370).keys()].map((i) => i + 0x370),
};

const PLAYWRIGHT_HINT = `
Subsetting needs Playwright to scrape the rendered glyph set from the page.
Install once per machine:

  npm install playwright
  npx playwright install chromium

Then re-run \`fontfetch subset <url>\`.
`.trim();

const HARFBUZZ_HINT = `
Subsetting needs the subset-font package (a WASM wrapper around harfbuzzjs).
Install:

  npm install subset-font

Then re-run \`fontfetch subset <url>\`.
`.trim();

/**
 * Render the page in headless Chromium, walk every visible text node, and
 * return the unique set of codepoints found. Includes computed-style
 * `content` values from `::before` / `::after` pseudo-elements so icon-fonts
 * driven by `content: "\\f001"` do not get stripped out.
 */
async function scrapePageGlyphs(url: string): Promise<string> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(PLAYWRIGHT_HINT);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);

    const text = await page.evaluate(() => {
      const chunks: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node) {
        const t = node.nodeValue;
        if (t) chunks.push(t);
        node = walker.nextNode();
      }

      // Pseudo-element generated content (icon fonts use this heavily).
      const all = document.querySelectorAll<HTMLElement>('*');
      for (const el of Array.from(all).slice(0, 5000)) {
        for (const pseudo of ['::before', '::after'] as const) {
          const content = window.getComputedStyle(el, pseudo).getPropertyValue('content');
          if (content && content !== 'none' && content !== 'normal') {
            const unquoted = content.replace(/^["']|["']$/g, '');
            chunks.push(unquoted);
          }
        }
      }
      return chunks.join(' ');
    });
    return text;
  } finally {
    await browser.close();
  }
}

function uniqueCodepoints(text: string, extras: number[] = []): string {
  const set = new Set<number>();
  for (const cp of [...text]) set.add(cp.codePointAt(0)!);
  for (const cp of extras) set.add(cp);
  return [...set]
    .sort((a, b) => a - b)
    .map((cp) => String.fromCodePoint(cp))
    .join('');
}

type FontkitCharsetFont = { characterSet?: number[]; familyName?: string };

/**
 * Open a font binary with fontkit and return its supported codepoints. Used
 * by the splitter to decide whether a bucket has enough overlap with the
 * source font to be worth emitting. Picks the first member of a TTC.
 */
function readFontCharset(buffer: Buffer): { codepoints: Set<number>; family: string | null } {
  const opened = (fontkit as unknown as { create: (b: Buffer) => unknown }).create(buffer);
  let font: FontkitCharsetFont;
  if (opened && typeof opened === 'object' && 'fonts' in opened) {
    font = (opened as { fonts: FontkitCharsetFont[] }).fonts[0];
  } else {
    font = opened as FontkitCharsetFont;
  }
  const charset = new Set<number>(font.characterSet ?? []);
  return { codepoints: charset, family: font.familyName ?? null };
}

/**
 * Subset every font file under <baseDir>/<host>/files/ to the glyphs actually
 * used on the page. Emits siblings named `<original>.subset.woff2`.
 */
export async function subset(options: SubsetOptions): Promise<SubsetReport> {
  let subsetFont: SubsetFontFn;
  try {
    const mod = (await import('subset-font')) as unknown as { default: SubsetFontFn };
    subsetFont = mod.default;
  } catch {
    throw new Error(HARFBUZZ_HINT);
  }

  let pullResult: PullResult;
  if (options.skipPull) {
    // Caller already ran pull; resolve the output directory by hostname.
    const host = new URL(options.url).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    pullResult = {
      outDir: path.join(path.resolve(options.baseDir), host),
      faces: [],
      orphans: [],
      downloaded: 0,
      total: 0,
      variableFonts: [],
      pagesCrawled: 1,
      discoveredNextjsSiblings: [],
    };
  } else {
    log.info('→ Step 1/2: extracting fonts (static + headless)');
    pullResult = await pull({ url: options.url, baseDir: options.baseDir, headless: true });
    if (pullResult.total === 0) {
      return emptyReport(pullResult.outDir, options.url);
    }
  }

  // --split-ranges flow: skip DOM scrape, emit one subset file per Google-
  // Fonts language bucket the source font has glyphs for, and emit a chained
  // `fonts.subset.css` with `unicode-range:` declarations. Mutually
  // exclusive with the rendered-set / whitelist path below — split-mode is
  // about ranged lazy-loading, not page-content subsetting.
  if (options.splitRanges) {
    return runSplit(pullResult, options, subsetFont);
  }

  log.info('→ Step 2/2: scraping rendered glyph set');
  const renderedText = options.text ?? (await scrapePageGlyphs(options.url));
  const extras: number[] = [];
  for (const range of options.preserveRanges ?? []) {
    extras.push(...SUBSET_RANGES[range]);
  }
  // Whitelist codepoints are merged in alongside `preserveRanges` — both
  // exist to keep glyphs alive that the DOM walk couldn't see.
  if (options.whitelist) extras.push(...options.whitelist);
  const codepoints = uniqueCodepoints(renderedText, extras);
  log.info(`  ${codepoints.length.toLocaleString()} unique codepoint(s) observed`);

  const filesDir = path.join(pullResult.outDir, 'files');
  const fontFiles = await collectFontFiles(filesDir);

  const perFile: SubsetFileReport[] = [];
  const errors: { file: string; reason: string }[] = [];
  let totalOriginal = 0;
  let totalSubset = 0;

  for (const file of fontFiles) {
    if (/\.subset\.(woff2|woff|ttf|otf)$/i.test(file)) continue;
    try {
      const original = await fs.readFile(file);
      const subsetBuffer = await subsetFont(original, codepoints, { targetFormat: 'woff2' });
      const outFile = file.replace(/\.(woff2|woff|ttf|otf)$/i, '.subset.woff2');
      await fs.writeFile(outFile, subsetBuffer);
      const savedBytes = original.length - subsetBuffer.length;
      const savedPct = original.length > 0 ? (savedBytes / original.length) * 100 : 0;
      log.info(
        `  ✓ ${path.relative(filesDir, outFile)}  ${(subsetBuffer.length / 1024).toFixed(1)} KB (was ${(original.length / 1024).toFixed(1)} KB, −${savedPct.toFixed(0)}%)`,
      );
      perFile.push({
        file: path.relative(filesDir, outFile),
        originalBytes: original.length,
        subsetBytes: subsetBuffer.length,
        saved: savedBytes,
        savedPct,
      });
      totalOriginal += original.length;
      totalSubset += subsetBuffer.length;
    } catch (e) {
      const reason = (e as Error).message;
      log.warn(`  ✗ ${path.relative(filesDir, file)} — ${reason}`);
      errors.push({ file: path.relative(filesDir, file), reason });
    }
  }

  const totalSaved = totalOriginal - totalSubset;
  const totalSavedPct = totalOriginal > 0 ? (totalSaved / totalOriginal) * 100 : 0;

  return {
    outDir: pullResult.outDir,
    url: options.url,
    uniqueCodepoints: codepoints.length,
    filesAttempted: fontFiles.length,
    filesSubset: perFile.length,
    totalOriginalBytes: totalOriginal,
    totalSubsetBytes: totalSubset,
    totalSavedBytes: totalSaved,
    totalSavedPct,
    perFile,
    errors,
  };
}

type SubsetFontFn = (
  buffer: Buffer,
  text: string,
  options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype' },
) => Promise<Buffer>;

/**
 * Per-language split flow. Mirrors what Google Fonts serves for a multi-
 * script family: one woff2 per language bucket, chained from CSS via
 * `unicode-range:` so the browser only fetches the buckets it needs.
 *
 * For every font file under `<outDir>/files/` we:
 *   1. Open it with fontkit to read the character set + family/subfamily.
 *   2. Intersect its character set against each Google Fonts bucket
 *      (`GOOGLE_FONTS_RANGES`). Buckets with fewer than
 *      `MIN_GLYPHS_PER_BUCKET` matching codepoints are skipped — emitting
 *      a near-empty woff2 isn't worth the extra request.
 *   3. Subset the binary down to that intersection via harfbuzzjs and
 *      write `<stem>.<bucket>.subset.woff2`.
 *   4. Aggregate the emitted files per family and build `fonts.subset.css`
 *      with one `@font-face` per bucket carrying the matching
 *      `unicode-range:`.
 */
async function runSplit(
  pullResult: PullResult,
  options: SubsetOptions,
  subsetFont: SubsetFontFn,
): Promise<SubsetReport> {
  log.info('→ Step 2/2: splitting each font by Google Fonts language ranges');

  const buckets: UnicodeRangeBucket[] = (() => {
    if (!options.splitBuckets || options.splitBuckets.length === 0) {
      return [...GOOGLE_FONTS_RANGES];
    }
    const allowed = new Set(options.splitBuckets);
    const filtered = GOOGLE_FONTS_RANGES.filter((b) => allowed.has(b.name));
    if (filtered.length === 0) {
      throw new Error(
        `--split-ranges=${options.splitBuckets.join(',')} matched no known buckets. Available: ${GOOGLE_FONTS_RANGES.map((b) => b.name).join(', ')}`,
      );
    }
    return filtered;
  })();

  // Pre-expand bucket codepoint sets once — each bucket is reused across every font file.
  const expandedBuckets = buckets.map((b) => ({
    bucket: b,
    codepoints: expandBucket(b),
  }));

  const filesDir = path.join(pullResult.outDir, 'files');
  const fontFiles = await collectFontFiles(filesDir);

  const perFile: SubsetFileReport[] = [];
  const splits: SplitFamilyReport[] = [];
  const errors: { file: string; reason: string }[] = [];
  let totalOriginal = 0;
  let totalSubset = 0;

  // Map each on-disk binary back to its FontFace entry (if any) so we can
  // recover weight/style for the emitted CSS. `pull()` populates
  // `sources[i].localFile` to a path relative to `files/`.
  const faceByLocal = new Map<string, { family: string; weight: string; style: string }>();
  for (const f of pullResult.faces) {
    for (const s of f.sources) {
      if (s.localFile && !faceByLocal.has(s.localFile)) {
        faceByLocal.set(s.localFile, { family: f.family, weight: f.weight, style: f.style });
      }
    }
  }

  for (const file of fontFiles) {
    if (/\.subset\.(woff2|woff|ttf|otf)$/i.test(file)) continue;
    let original: Buffer;
    try {
      original = await fs.readFile(file);
    } catch (e) {
      errors.push({ file: path.relative(filesDir, file), reason: (e as Error).message });
      continue;
    }

    let charsetInfo: { codepoints: Set<number>; family: string | null };
    try {
      charsetInfo = readFontCharset(original);
    } catch (e) {
      errors.push({ file: path.relative(filesDir, file), reason: `fontkit: ${(e as Error).message}` });
      continue;
    }

    const localRel = path.relative(filesDir, file);
    const faceMeta = faceByLocal.get(localRel);
    const family = faceMeta?.family ?? charsetInfo.family ?? path.basename(file, path.extname(file));
    const familyReport: SplitFamilyReport = {
      family,
      sourceFile: localRel,
      buckets: [],
    };

    totalOriginal += original.length;

    let emittedForThisFile = 0;
    for (const { bucket, codepoints } of expandedBuckets) {
      const intersection: number[] = [];
      for (const cp of codepoints) {
        if (charsetInfo.codepoints.has(cp)) intersection.push(cp);
      }
      if (intersection.length < MIN_GLYPHS_PER_BUCKET) continue;

      const text = intersection.map((cp) => String.fromCodePoint(cp)).join('');
      try {
        const subsetBuffer = await subsetFont(original, text, { targetFormat: 'woff2' });
        const outFile = file.replace(
          /\.(woff2|woff|ttf|otf)$/i,
          `.${bucket.name}.subset.woff2`,
        );
        await fs.writeFile(outFile, subsetBuffer);
        const outRel = path.relative(filesDir, outFile);
        const savedBytes = original.length - subsetBuffer.length;
        const savedPct = original.length > 0 ? (savedBytes / original.length) * 100 : 0;
        log.info(
          `  ✓ ${outRel}  ${(subsetBuffer.length / 1024).toFixed(1)} KB (${intersection.length} cp, −${savedPct.toFixed(0)}%)`,
        );
        perFile.push({
          file: outRel,
          originalBytes: original.length,
          subsetBytes: subsetBuffer.length,
          saved: savedBytes,
          savedPct,
          bucket: bucket.name,
        });
        familyReport.buckets.push({
          bucket: bucket.name,
          file: outRel,
          codepoints: intersection.length,
          bytes: subsetBuffer.length,
        });
        totalSubset += subsetBuffer.length;
        emittedForThisFile++;
      } catch (e) {
        const reason = (e as Error).message;
        log.warn(`  ✗ ${localRel} (${bucket.name}) — ${reason}`);
        errors.push({ file: `${localRel} [${bucket.name}]`, reason });
      }
    }

    if (emittedForThisFile === 0) {
      log.warn(`  ! ${localRel} — no bucket overlap, kept as-is`);
    } else {
      splits.push(familyReport);
    }
  }

  // Chain emitted bucket files into a CSS file. Each face references its
  // bucket-specific `unicode-range:` so browsers lazy-load the language
  // they need. We deliberately emit a fresh `fonts.subset.css` rather than
  // mutate `fonts.css` — the original keeps working unchanged.
  const splitCssPath = path.join(pullResult.outDir, 'fonts.subset.css');
  await fs.writeFile(splitCssPath, buildSplitCss(splits, expandedBuckets, faceByLocal));

  const totalSaved = totalOriginal - totalSubset;
  const totalSavedPct = totalOriginal > 0 ? (totalSaved / totalOriginal) * 100 : 0;

  return {
    outDir: pullResult.outDir,
    url: options.url,
    uniqueCodepoints: 0, // not meaningful in split mode — full font coverage is used
    filesAttempted: fontFiles.length,
    filesSubset: perFile.length,
    totalOriginalBytes: totalOriginal,
    totalSubsetBytes: totalSubset,
    totalSavedBytes: totalSaved,
    totalSavedPct,
    perFile,
    errors,
    splits,
    splitCss: path.relative(pullResult.outDir, splitCssPath),
  };
}

/**
 * Build a chained `@font-face` block per family / per bucket. Mirrors the
 * shape Google Fonts ships in its `css2` payload. Weight/style come from
 * the parsed @font-face when fontfetch knows it (typical pull case); a
 * 400/normal default is used when only the binary is known (skipPull /
 * orphan files).
 */
function buildSplitCss(
  splits: SplitFamilyReport[],
  expandedBuckets: { bucket: UnicodeRangeBucket; codepoints: number[] }[],
  faceByLocal: Map<string, { family: string; weight: string; style: string }>,
): string {
  const lines: string[] = [
    '/* Auto-generated by fontfetch — per-language subset bundle (v1.3 --split-ranges). */',
    '/* Drop the per-bucket files in files/ next to this CSS, link this stylesheet. */',
    '/* Browsers fetch only the buckets they need at runtime via the unicode-range hint. */',
    '',
  ];

  const bucketRangeByName = new Map<string, string>(
    expandedBuckets.map((e) => [e.bucket.name, e.bucket.unicodeRange]),
  );

  for (const split of splits) {
    const meta = faceByLocal.get(split.sourceFile) ?? {
      family: split.family,
      weight: '400',
      style: 'normal',
    };
    for (const entry of split.buckets) {
      const range = bucketRangeByName.get(entry.bucket);
      lines.push(`/* ${meta.family} — ${entry.bucket} (${entry.codepoints} codepoints, ${(entry.bytes / 1024).toFixed(1)} KB) */`);
      lines.push('@font-face {');
      lines.push(`  font-family: '${meta.family}';`);
      lines.push(`  font-style: ${meta.style};`);
      lines.push(`  font-weight: ${meta.weight};`);
      lines.push('  font-display: swap;');
      lines.push(`  src: url('./files/${entry.file}') format('woff2');`);
      if (range) lines.push(`  unicode-range: ${range};`);
      lines.push('}');
      lines.push('');
    }
  }
  return lines.join('\n');
}

async function collectFontFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let items;
    try {
      items = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) await walk(p);
      else if (/\.(woff2|woff|ttf|otf)$/i.test(it.name)) out.push(p);
    }
  }
  await walk(root);
  return out;
}

function emptyReport(outDir: string, url: string): SubsetReport {
  return {
    outDir,
    url,
    uniqueCodepoints: 0,
    filesAttempted: 0,
    filesSubset: 0,
    totalOriginalBytes: 0,
    totalSubsetBytes: 0,
    totalSavedBytes: 0,
    totalSavedPct: 0,
    perFile: [],
    errors: [],
  };
}
