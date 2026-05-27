import {
  pull,
  log,
  isEmitTarget,
  EMIT_TARGETS,
  inspect,
  formatInspectionReport,
  subset,
  type EmitTarget,
} from '@fontfetch/core';

const VERSION = '1.2.0';

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

Examples:
  fontfetch https://shinobidata.com
  fontfetch https://shinobidata.com ./fonts
  fontfetch https://linear.app --headless
  fontfetch https://vercel.com --emit next,tailwind
  fontfetch https://stripe.com --headless --fallback --emit next
  fontfetch inspect ./fonts/example.com/files/google/Inter-Variable.woff2
  fontfetch subset https://stripe.com
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
  const positional = args.filter((a) => !a.startsWith('--'));
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
    const report = await subset({ url, baseDir: outDir });
    log.info('');
    if (report.filesSubset === 0) {
      log.info('No font files to subset.');
      process.exit(0);
    }
    const beforeKb = (report.totalOriginalBytes / 1024).toFixed(1);
    const afterKb = (report.totalSubsetBytes / 1024).toFixed(1);
    log.info(
      `Done. ${report.filesSubset}/${report.filesAttempted} subsetted, ${beforeKb} KB → ${afterKb} KB ` +
        `(−${report.totalSavedPct.toFixed(0)}%, saved ${(report.totalSavedBytes / 1024).toFixed(1)} KB) ` +
        `→ ${report.outDir}/files/`,
    );
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

  const reservedFlags = new Set(['--headless', '--emit', '--force', '--fallback']);
  const positional = args.filter((a: string, i: number) => {
    if (a.startsWith('--')) return false;
    if (i > 0 && args[i - 1] === '--emit') return false;
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

  const result = await pull({ url, baseDir: outDir, headless, emit, force, fallback });

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
