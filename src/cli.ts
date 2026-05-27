#!/usr/bin/env node
import { pull } from './pull.js';
import { log } from './utils.js';
import { isEmitTarget, EMIT_TARGETS, type EmitTarget } from './emitters/index.js';

const VERSION = '0.4.0';

function printHelp(): void {
  log.info(`fontfetch ${VERSION}

Usage:
  fontfetch <url> [outDir] [flags]

Arguments:
  <url>             Page to download fonts from (https://example.com)
  [outDir]          Directory to write output into (default: ./downloaded-fonts)

Flags:
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
  --force           Download even if every detected font is served from a
                    known commercial-foundry CDN. Default behaviour is to
                    abort early and emit only LICENSE_REVIEW.md.
  -h, --help        Show this help
  -v, --version     Print version

Examples:
  fontfetch https://stripe.com
  fontfetch https://stripe.com ./fonts
  fontfetch https://linear.app --headless
  fontfetch https://vercel.com --emit next,tailwind
  npx fontfetch https://stripe.com

Output (per site):
  <outDir>/<hostname>/
    files/          Raw font files (woff2/woff/ttf/otf/eot)
    fonts.css       Ready-to-use @font-face block with local URLs
    fonts.json      Manifest grouped by family/weight/style
    README.md       Human-readable summary

For local design exploration. You're responsible for licensing the fonts you use.
`);
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

  const headless = args.includes('--headless');
  const force = args.includes('--force');

  // --emit <targets> may be either separated by space or '=' (e.g. --emit=next,tailwind)
  let emit: Exclude<EmitTarget, 'css'>[] = [];
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

  const reservedFlags = new Set(['--headless', '--emit', '--force']);
  const positional = args.filter((a: string, i: number) => {
    if (a.startsWith('--')) return false;
    // Skip the value that follows a space-separated --emit
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

  const result = await pull({ url, baseDir: outDir, headless, emit, force });

  log.info('');
  if (result.total === 0) {
    log.info('No fonts found.');
    process.exit(0);
  }
  log.info(`Done. ${result.downloaded}/${result.total} files saved to ${result.outDir}`);
}

main().catch((e: unknown) => {
  log.err(String(e));
  process.exit(1);
});
