#!/usr/bin/env node
import { pull } from './pull.js';
import { log } from './utils.js';

const VERSION = '0.2.0';

function printHelp(): void {
  log.info(`fontfetch ${VERSION}

Usage:
  fontfetch <url> [outDir] [flags]

Arguments:
  <url>           Page to scrape fonts from (https://example.com)
  [outDir]        Directory to write output into (default: ./downloaded-fonts)

Flags:
  --headless      Use Playwright to also capture JS-loaded fonts (SPAs,
                  late-injected @font-face rules). Requires:
                    npm install playwright
                    npx playwright install chromium
  -h, --help      Show this help
  -v, --version   Print version

Examples:
  fontfetch https://stripe.com
  fontfetch https://stripe.com ./fonts
  fontfetch https://linear.app --headless
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
  const positional = args.filter((a: string) => !a.startsWith('--'));
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

  const result = await pull({ url, baseDir: outDir, headless });

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
