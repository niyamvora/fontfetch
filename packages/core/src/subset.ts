import fs from 'node:fs/promises';
import path from 'node:path';
import { pull } from './pull.js';
import { log, UA } from './utils.js';
import type { PullResult } from './types.js';

export interface SubsetFileReport {
  file: string;
  originalBytes: number;
  subsetBytes: number;
  saved: number;
  savedPct: number;
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

/**
 * Subset every font file under <baseDir>/<host>/files/ to the glyphs actually
 * used on the page. Emits siblings named `<original>.subset.woff2`.
 */
export async function subset(options: SubsetOptions): Promise<SubsetReport> {
  type SubsetFontFn = (
    buffer: Buffer,
    text: string,
    options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype' },
  ) => Promise<Buffer>;
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

  log.info('→ Step 2/2: scraping rendered glyph set');
  const renderedText = options.text ?? (await scrapePageGlyphs(options.url));
  const extras: number[] = [];
  for (const range of options.preserveRanges ?? []) {
    extras.push(...SUBSET_RANGES[range]);
  }
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
