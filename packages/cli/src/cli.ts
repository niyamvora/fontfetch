import {
  pull,
  log,
  isEmitTarget,
  EMIT_TARGETS,
  inspect,
  formatInspectionReport,
  subset,
  FONT_FORMATS,
  isFontFormat,
  parseUnicodeRange,
  GOOGLE_FONTS_RANGES,
  type EmitTarget,
  type FontFormat,
} from '@fontfetch/core';

const VERSION = '1.3.0';

function printHelp(): void {
  log.info(`fontfetch ${VERSION}

Usage:
  fontfetch <url> [outDir] [flags]       Extract every webfont from a URL
  fontfetch inspect <file>               Print a terminal report for a font file
  fontfetch subset <url> [outDir]        Extract + subset to glyphs actually rendered on the page

Arguments (default command):
  <url>             Page to download fonts from (https://example.com)
  [outDir]          Directory to write output into (default: ./downloaded-fonts)

Flags (default command):
  --headless        Use Playwright to also capture JS-loaded fonts (SPAs,
                    late-injected @font-face rules). Requires:
                      npm install playwright
                      npx playwright install chromium
  --pages <N>       Crawl up to N pages (entry + N-1 internal links) and
                    merge fonts across all of them. Solves the case where
                    the homepage and /blog use different families. Default
                    1 (entry only). Maximum 50.
  --formats <list>  Comma-separated allowlist of font formats to keep. One or
                    more of: ${FONT_FORMATS.join(', ')}. Faces with no
                    source in the allowlist are dropped. Example:
                      --formats=woff2        Modern-only output (halves bundle size)
                      --formats=woff2,woff   Slight legacy reach
                    Default: keep every format the upstream CSS provides.
  --emit <targets>  Comma-separated framework targets to emit alongside the
                    default fonts.css. One or more of: ${EMIT_TARGETS.join(', ')}
                    Examples:
                      --emit next            Next.js next/font/local file
                      --emit tailwind        Tailwind fontFamily snippet
                      --emit next,tailwind   Both (pair for CSS variables)
                      --emit vite            Vite integration guide
  --fallback        Emit a CLS-killing 'Fallback' @font-face for every family,
                    with size-adjust / ascent-override / descent-override /
                    line-gap-override matched to a system fallback (Arial /
                    Times / Courier) via capsize metrics. No CLS while the
                    primary font loads, framework-agnostic.
  --force           Download even if every detected font is served from a
                    known commercial-foundry CDN. Default behaviour is to
                    abort early and emit only LICENSE_REVIEW.md.
  -h, --help        Show this help
  -v, --version     Print version

Flags (subset subcommand):
  --whitelist <list>
                    Extra codepoints to always include, on top of whatever
                    the DOM walk produced. Same syntax as a CSS unicode-range:
                      --whitelist=U+00A0,U+20AC,U+0020-007F
                    Use for currency, breaking-space variants, locale
                    punctuation, icon-font glyphs loaded via JS.
  --split-ranges [=buckets]
                    Emit one woff2 per Google Fonts language bucket (latin,
                    latin-ext, cyrillic, cyrillic-ext, greek, greek-ext,
                    vietnamese) with a chained fonts.subset.css. Closes the
                    glyphhanger gap: now your output is interchangeable with
                    Google Fonts' own per-language splits. Skip the DOM scrape
                    in this mode — split files cover the full font coverage
                    per range so browsers can lazy-load by language.
                    Optional value restricts to named buckets, e.g.
                      --split-ranges=latin,latin-ext,cyrillic
                    Available buckets: ${GOOGLE_FONTS_RANGES.map((b) => b.name).join(', ')}

Examples:
  fontfetch https://shinobidata.com
  fontfetch https://shinobidata.com ./fonts
  fontfetch https://linear.app --headless
  fontfetch https://vercel.com --emit next,tailwind
  fontfetch https://stripe.com --headless --fallback --emit next
  fontfetch https://acme.com --pages=5         (homepage + 4 internal links)
  fontfetch https://shinobidata.com --formats=woff2
  fontfetch inspect ./fonts/example.com/files/google/Inter-Variable.woff2
  fontfetch subset https://stripe.com
  fontfetch subset https://stripe.com --whitelist=U+00A0,U+20AC
  fontfetch subset https://stripe.com --split-ranges
  fontfetch subset https://stripe.com --split-ranges=latin,latin-ext
  npx fontfetch https://shinobidata.com

Output (per site):
  <outDir>/<hostname>/
    files/          Raw font files (woff2/woff/ttf/otf/eot)
    fonts.css       Ready-to-use @font-face block with local URLs
                    (font-display: swap default + optional CLS fallbacks)
    fonts.json      Manifest grouped by family/weight/style
    README.md       Human-readable summary
    LICENSE_REVIEW.md  Per-face license verdict (open / commercial / unknown)

For local design exploration. You're responsible for licensing the fonts you use.
`);
}

async function runInspect(args: string[]): Promise<void> {
  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    log.err('Missing <file> argument. Usage: fontfetch inspect <path-to-font>');
    process.exit(1);
  }
  try {
    const report = await inspect(filePath);
    log.info(formatInspectionReport(report));
  } catch (e) {
    log.err(`inspect failed: ${(e as Error).message}`);
    process.exit(1);
  }
}

async function runSubset(args: string[]): Promise<void> {
  // --whitelist=U+00A0,U+20AC  or  --whitelist U+00A0,U+20AC
  let whitelist: number[] | undefined;
  const whitelistIdx = args.findIndex(
    (a) => a === '--whitelist' || a.startsWith('--whitelist='),
  );
  if (whitelistIdx !== -1) {
    const raw =
      args[whitelistIdx] === '--whitelist'
        ? args[whitelistIdx + 1]
        : args[whitelistIdx].slice('--whitelist='.length);
    if (!raw) {
      log.err('--whitelist requires a value, e.g. --whitelist=U+00A0,U+20AC');
      process.exit(1);
    }
    try {
      whitelist = parseUnicodeRange(raw);
    } catch (e) {
      log.err((e as Error).message);
      process.exit(1);
    }
  }

  // --split-ranges, --split-ranges=<buckets>
  let splitRanges = false;
  let splitBuckets: string[] | undefined;
  const splitIdx = args.findIndex(
    (a) => a === '--split-ranges' || a.startsWith('--split-ranges='),
  );
  if (splitIdx !== -1) {
    splitRanges = true;
    if (args[splitIdx].startsWith('--split-ranges=')) {
      const raw = args[splitIdx].slice('--split-ranges='.length);
      splitBuckets = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (splitBuckets.length === 0) splitBuckets = undefined;
    }
  }

  const subsetReserved = new Set(['--whitelist']);
  const positional = args.filter((a, i) => {
    if (a.startsWith('--')) return false;
    if (i > 0 && args[i - 1] === '--whitelist') return false;
    if (subsetReserved.has(a)) return false;
    return true;
  });
  const [url, outDir = './downloaded-fonts'] = positional;
  if (!url) {
    log.err('Missing <url> argument. Usage: fontfetch subset <url> [outDir]');
    process.exit(1);
  }
  try {
    new URL(url);
  } catch {
    log.err(`Invalid URL: ${url}`);
    process.exit(1);
  }
  try {
    const report = await subset({
      url,
      baseDir: outDir,
      whitelist,
      splitRanges,
      splitBuckets,
    });
    log.info('');
    if (report.filesSubset === 0) {
      log.info('No font files to subset.');
      process.exit(0);
    }
    const beforeKb = (report.totalOriginalBytes / 1024).toFixed(1);
    const afterKb = (report.totalSubsetBytes / 1024).toFixed(1);
    const summary =
      `Done. ${report.filesSubset}/${report.filesAttempted} subsetted, ${beforeKb} KB → ${afterKb} KB ` +
      `(−${report.totalSavedPct.toFixed(0)}%, saved ${(report.totalSavedBytes / 1024).toFixed(1)} KB) ` +
      `→ ${report.outDir}/files/`;
    log.info(summary);
    if (report.splitCss) {
      log.info(`        + chained @font-face block emitted at ${report.outDir}/${report.splitCss}`);
    }
  } catch (e) {
    log.err(`subset failed: ${(e as Error).message}`);
    process.exit(1);
  }
}

async function runPull(args: string[]): Promise<void> {
  const headless = args.includes('--headless');
  const force = args.includes('--force');
  const fallback = args.includes('--fallback');

  // --emit <targets> may be either separated by space or '=' (e.g. --emit=next,tailwind)
  const emit: Exclude<EmitTarget, 'css'>[] = [];
  const emitIdx = args.findIndex((a: string) => a === '--emit' || a.startsWith('--emit='));
  if (emitIdx !== -1) {
    const raw =
      args[emitIdx] === '--emit'
        ? args[emitIdx + 1]
        : args[emitIdx].slice('--emit='.length);
    if (!raw) {
      log.err(`--emit requires a value. One or more of: ${EMIT_TARGETS.join(', ')}`);
      process.exit(1);
    }
    const requested = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    for (const r of requested) {
      if (!isEmitTarget(r)) {
        log.err(`Unknown --emit target: '${r}'. Valid: ${EMIT_TARGETS.join(', ')}`);
        process.exit(1);
      }
      if (r !== 'css') emit.push(r);
    }
  }

  // --pages <N> or --pages=N
  let pages = 1;
  const pagesIdx = args.findIndex((a: string) => a === '--pages' || a.startsWith('--pages='));
  if (pagesIdx !== -1) {
    const raw =
      args[pagesIdx] === '--pages'
        ? args[pagesIdx + 1]
        : args[pagesIdx].slice('--pages='.length);
    if (!raw) {
      log.err('--pages requires a number, e.g. --pages=5 (or --pages 5).');
      process.exit(1);
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      log.err(`--pages must be a positive integer, got '${raw}'.`);
      process.exit(1);
    }
    pages = parsed;
  }

  // --formats=woff2,woff   or   --formats woff2
  let formats: FontFormat[] | undefined;
  const formatsIdx = args.findIndex(
    (a: string) => a === '--formats' || a.startsWith('--formats='),
  );
  if (formatsIdx !== -1) {
    const raw =
      args[formatsIdx] === '--formats'
        ? args[formatsIdx + 1]
        : args[formatsIdx].slice('--formats='.length);
    if (!raw) {
      log.err(`--formats requires a value. One or more of: ${FONT_FORMATS.join(', ')}`);
      process.exit(1);
    }
    const requested = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const validated: FontFormat[] = [];
    for (const r of requested) {
      const norm = r.toLowerCase();
      if (!isFontFormat(norm)) {
        log.err(`Unknown --formats value: '${r}'. Valid: ${FONT_FORMATS.join(', ')}`);
        process.exit(1);
      }
      validated.push(norm);
    }
    formats = validated;
  }

  const reservedFlags = new Set([
    '--headless',
    '--emit',
    '--force',
    '--fallback',
    '--pages',
    '--formats',
  ]);
  const positional = args.filter((a: string, i: number) => {
    if (a.startsWith('--')) return false;
    if (
      i > 0 &&
      (args[i - 1] === '--emit' ||
        args[i - 1] === '--pages' ||
        args[i - 1] === '--formats')
    )
      return false;
    if (reservedFlags.has(a)) return false;
    return true;
  });
  const [url, outDir = './downloaded-fonts'] = positional;

  if (!url) {
    log.err('Missing <url> argument. Run with --help for usage.');
    process.exit(1);
  }
  try {
    new URL(url);
  } catch {
    log.err(`Invalid URL: ${url}`);
    process.exit(1);
  }

  const result = await pull({
    url,
    baseDir: outDir,
    headless,
    emit,
    force,
    fallback,
    pages,
    formats,
  });

  log.info('');
  if (result.total === 0) {
    log.info('No fonts found.');
    process.exit(0);
  }
  log.info(`Done. ${result.downloaded}/${result.total} files saved to ${result.outDir}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    log.info(VERSION);
    process.exit(0);
  }

  const [command, ...rest] = args;
  if (command === 'inspect') {
    await runInspect(rest);
    return;
  }
  if (command === 'subset') {
    await runSubset(rest);
    return;
  }

  // Default: legacy `fontfetch <url>` pull behaviour.
  await runPull(args);
}

main().catch((e: unknown) => {
  log.err(String(e));
  process.exit(1);
});
