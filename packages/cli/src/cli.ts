import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
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
  diffPulls,
  formatFontDiff,
  audit,
  formatAuditReport,
  type EmitTarget,
  type FontFormat,
} from '@fontfetch/core';
import {
  morph,
  resolvePosture,
  decideMorphPolicy,
  watermarkText,
  type FontLicenseSignal,
} from '@fontfetch/morph';

const VERSION = '1.5.0';

function printHelp(): void {
  log.info(`fontfetch ${VERSION}

Usage:
  fontfetch <url> [outDir] [flags]       Extract every webfont from a URL
  fontfetch inspect <file>               Print a terminal report for a font file
  fontfetch subset <url> [outDir]        Extract + subset to glyphs actually rendered on the page
  fontfetch diff <urlA> <urlB>           Diff the font set between two URLs (v1.4)
  fontfetch audit <url> [flags]          CI-friendly checks: budget, no-commercial (v1.4, non-zero exit on fail)
  fontfetch budget <url> --max-kb N      Convenience around audit for the bundle-size dimension (v1.4)
  fontfetch morph <file> [flags]         Prototype-morph a font: round / widen / slant / thicken (v1.5)

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
                      --emit tokens          W3C / Style Dictionary design tokens (v1.4)
  --gdpr-report     Emit GDPR.md + gdpr.json listing every third-party font
                    request with self-host remediation. Post-LG München I
                    20 O 1393/21 (2022) German court ruling on Google Fonts
                    CDN. (v1.4)
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

Flags (audit / budget subcommand, v1.4):
  --max-kb <N>      Total bundle size budget in KB; exceeds → exit 1
  --per-family-kb <list>
                    Per-family budgets: "Inter:30,Geist:40"
  --no-commercial   Exit 1 if any face is classified as commercial
  --json            Emit machine-readable JSON instead of human-readable output

Examples (v1.4):
  fontfetch diff https://staging.acme.com https://acme.com
  fontfetch diff https://staging.acme.com https://acme.com --json
  fontfetch audit https://acme.com --max-kb 200 --no-commercial
  fontfetch budget https://acme.com --max-kb 100 --json

Flags (morph subcommand, v1.5):
  --round <N>       Corner radius 0–100 (% of the shorter adjacent edge)
  --width <N>       Horizontal scale 80–120 (%)
  --slant <N>       Slant angle 0–15 (degrees, faux italic)
  --weight <N>      Stroke delta −15…+15 (%); experimental on static fonts
  --rename <name>   Output family name (default: "<original> Prototype")
  --out <dir>       Output directory (default: ./morphed-fonts)
  --json            Machine-readable result on stdout

  Licensing: commercial / unknown-license inputs are warned about, watermarked
  in the binary, and written as a MOCKUP bundle — prototype use only. OFL fonts
  get the clean path (Reserved Font Names are renamed). Set
  FONTFETCH_MORPH_POSTURE=ofl-only to refuse non-OFL inputs entirely.

Examples (v1.5):
  fontfetch morph ./Inter.ttf --round=20 --width=108
  fontfetch morph ./Geist.otf --slant=8 --rename "Geist Sketch"
  fontfetch morph ./Inter.ttf --weight=10 --json

Output (per site):
  <outDir>/<hostname>/
    files/          Raw font files (woff2/woff/ttf/otf/eot)
    fonts.css       Ready-to-use @font-face block with local URLs
                    (font-display: swap default + optional CLS fallbacks)
    fonts.json      Manifest grouped by family/weight/style
    README.md       Human-readable summary
    LICENSE_REVIEW.md  Per-face license verdict (open / commercial / unknown)
    provenance.json    Machine-readable license + provenance report (v1.4)
    CONSISTENCY.md     Cross-page font consistency (when --pages > 1, v1.4)
    fonts.tokens.json  W3C design tokens (when --emit tokens, v1.4)

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
  const gdprReport = args.includes('--gdpr-report');

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
    '--gdpr-report',
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
    gdprReport,
  });

  log.info('');
  if (result.total === 0) {
    log.info('No fonts found.');
    process.exit(0);
  }
  log.info(`Done. ${result.downloaded}/${result.total} files saved to ${result.outDir}`);
}

/**
 * v1.4 — `fontfetch diff <url1> <url2>`. Runs `pull()` on two URLs and prints
 * a structured diff of their @font-face declarations. `--json` switches to
 * machine-readable output for CI / the upcoming GH Action.
 */
async function runDiff(args: string[]): Promise<void> {
  const wantJson = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  const [urlA, urlB, outDir = './downloaded-fonts'] = positional;
  if (!urlA || !urlB) {
    log.err('Usage: fontfetch diff <urlA> <urlB> [outDir] [--json]');
    process.exit(1);
  }
  try {
    new URL(urlA);
    new URL(urlB);
  } catch {
    log.err(`Invalid URL passed to diff`);
    process.exit(1);
  }
  try {
    const diff = await diffPulls(urlA, urlB, outDir);
    if (wantJson) {
      process.stdout.write(JSON.stringify(diff, null, 2) + '\n');
    } else {
      log.info('');
      log.info(formatFontDiff(diff));
    }
    process.exit(0);
  } catch (e) {
    log.err(`diff failed: ${(e as Error).message}`);
    process.exit(1);
  }
}

/**
 * v1.4 — `fontfetch audit <url> [--max-kb N] [--no-commercial] [--per-family-kb F:N,...]`.
 * Drop-in CI command. Exits non-zero when any configured rule is violated.
 */
async function runAudit(args: string[]): Promise<void> {
  const wantJson = args.includes('--json');
  const noCommercial = args.includes('--no-commercial');

  // --max-kb <N> or --max-kb=N
  let maxKb: number | undefined;
  const maxKbIdx = args.findIndex((a) => a === '--max-kb' || a.startsWith('--max-kb='));
  if (maxKbIdx !== -1) {
    const raw =
      args[maxKbIdx] === '--max-kb'
        ? args[maxKbIdx + 1]
        : args[maxKbIdx].slice('--max-kb='.length);
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      log.err(`--max-kb must be a positive integer, got '${raw}'`);
      process.exit(1);
    }
    maxKb = n;
  }

  // --per-family-kb Inter:30,Geist:40
  let perFamilyKb: Record<string, number> | undefined;
  const pfIdx = args.findIndex(
    (a) => a === '--per-family-kb' || a.startsWith('--per-family-kb='),
  );
  if (pfIdx !== -1) {
    const raw =
      args[pfIdx] === '--per-family-kb'
        ? args[pfIdx + 1]
        : args[pfIdx].slice('--per-family-kb='.length);
    perFamilyKb = {};
    for (const part of raw.split(',')) {
      const [family, kb] = part.split(':');
      if (!family || !kb) {
        log.err(`--per-family-kb expects 'Family:KB' pairs; got '${part}'`);
        process.exit(1);
      }
      const n = Number.parseInt(kb, 10);
      if (!Number.isFinite(n) || n <= 0) {
        log.err(`--per-family-kb value must be positive integer; got '${kb}'`);
        process.exit(1);
      }
      perFamilyKb[family.trim()] = n;
    }
  }

  const reserved = new Set(['--json', '--no-commercial', '--max-kb', '--per-family-kb']);
  const positional = args.filter((a, i) => {
    if (a.startsWith('--')) return false;
    if (i > 0 && (args[i - 1] === '--max-kb' || args[i - 1] === '--per-family-kb')) return false;
    if (reserved.has(a)) return false;
    return true;
  });
  const [url, outDir = './downloaded-fonts'] = positional;
  if (!url) {
    log.err('Usage: fontfetch audit <url> [outDir] [--max-kb N] [--no-commercial] [--per-family-kb F:N,...] [--json]');
    process.exit(1);
  }
  try {
    new URL(url);
  } catch {
    log.err(`Invalid URL: ${url}`);
    process.exit(1);
  }

  try {
    const report = await audit(url, outDir, { maxKb, perFamilyKb, noCommercial });
    if (wantJson) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      log.info('');
      log.info(formatAuditReport(report));
    }
    process.exit(report.passed ? 0 : 1);
  } catch (e) {
    log.err(`audit failed: ${(e as Error).message}`);
    process.exit(1);
  }
}

/**
 * v1.4 — `fontfetch budget <url> --max-kb N`. Convenience subcommand around
 * `audit` that only configures the total bundle budget. `--json` for CI.
 */
async function runBudget(args: string[]): Promise<void> {
  // Budget is just audit with the size dimension. Reuse runAudit.
  if (!args.some((a) => a === '--max-kb' || a.startsWith('--max-kb='))) {
    log.err('Usage: fontfetch budget <url> --max-kb <N> [outDir] [--json]');
    process.exit(1);
  }
  await runAudit(args);
}

/** Parse `--name=N` / `--name N` into a number, exiting on a bad value. */
function numFlag(args: string[], name: string): number | undefined {
  const idx = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (idx === -1) return undefined;
  const raw = args[idx] === name ? args[idx + 1] : args[idx].slice(name.length + 1);
  const n = Number(raw);
  if (raw === undefined || !Number.isFinite(n)) {
    log.err(`${name} requires a number, got '${raw ?? ''}'`);
    process.exit(1);
  }
  return n;
}

/** Parse `--name=value` / `--name value` into a string. */
function strFlag(args: string[], name: string): string | undefined {
  const idx = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (idx === -1) return undefined;
  const raw = args[idx] === name ? args[idx + 1] : args[idx].slice(name.length + 1);
  if (!raw) {
    log.err(`${name} requires a value`);
    process.exit(1);
  }
  return raw;
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font';

function mockupDisclaimer(family: string): string {
  return `# MOCKUP — not for production use

This font was produced by \`fontfetch morph\` from **${family}**, which is classified
as commercial or unknown-license. Its EULA almost certainly forbids modification,
**including** modification for mockups.

- Use this file **only** for internal prototyping and client ideation.
- **Do not** distribute, embed, or ship it.
- If the direction is approved, commission the real typeface from its foundry.

The binary carries an embedded watermark in its name table identifying it as a
fontfetch prototype. fontfetch is a sketchbook, not a font factory.
`;
}

function oflNotice(family: string, requiresRename: boolean): string {
  return `# Morphed font — OFL derivative

Produced by \`fontfetch morph\` from **${family}** (SIL Open Font License).

Under the OFL you may modify and redistribute this derivative provided you keep
the license and attribution with it, and note that it is a modified version.
${requiresRename ? '\n**Reserved Font Name:** the original family name must not appear in this\nderivative’s name — it has been renamed accordingly.\n' : ''}`;
}

/**
 * v1.5 — `fontfetch morph <file> [--round N] [--width N] [--slant N] [--weight N]`.
 * Prototyping-grade parametric morphing. Classifies the input via the binary's
 * name-table license, applies the posture guardrails (warn + watermark + rename
 * for commercial inputs, OFL rename for Reserved Font Names), and writes a
 * bundle. See @fontfetch/morph for the engine and the standing licensing
 * decision. Honour the people who make type.
 */
async function runMorph(args: string[]): Promise<void> {
  const wantJson = args.includes('--json');
  const round = numFlag(args, '--round');
  const width = numFlag(args, '--width');
  const slant = numFlag(args, '--slant');
  const weight = numFlag(args, '--weight');
  const renameFlag = strFlag(args, '--rename');
  const outDir = strFlag(args, '--out') ?? './morphed-fonts';

  const valueFlags = new Set(['--round', '--width', '--slant', '--weight', '--rename', '--out']);
  const positional = args.filter((a, i) => {
    if (a.startsWith('--')) return false;
    const prev = args[i - 1];
    if (prev && valueFlags.has(prev)) return false;
    return true;
  });
  const filePath = positional[0];
  if (!filePath) {
    log.err('Missing <file>. Usage: fontfetch morph <font-file> [--round N --width N --slant N --weight N]');
    process.exit(1);
  }

  let bytes: Uint8Array;
  try {
    bytes = readFileSync(filePath);
  } catch (e) {
    log.err(`Cannot read ${filePath}: ${(e as Error).message}`);
    process.exit(1);
  }

  // WOFF2 ('wOF2') can't be parsed by the morph engine yet — decompress first.
  if (bytes.length >= 4 && bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32) {
    log.err('WOFF2 input is not yet supported by morph. Convert to TTF/OTF/WOFF first (WOFF2 wiring is a later v1.5 step).');
    process.exit(1);
  }

  // Classify the input from its binary so the posture layer can decide. fontkit
  // (via core.inspect) reads name-table license fields woff2-and-all.
  let signal: FontLicenseSignal = { isOFL: false, hasRFN: false };
  try {
    const report = await inspect(filePath);
    signal = {
      isOFL: report.license?.isOFL ?? false,
      hasRFN: report.license?.hasRFN ?? false,
      vendor: report.vendor ?? undefined,
      family: report.familyName ?? undefined,
    };
  } catch (e) {
    log.err(`Could not read license from the binary (treating as restricted): ${(e as Error).message}`);
  }

  const policy = decideMorphPolicy(signal, { posture: resolvePosture() });
  if (!policy.allowed) {
    log.err(policy.blockedReason ?? 'Refused by morph posture.');
    process.exit(1);
  }

  const family = signal.family ?? basename(filePath).replace(/\.[^.]+$/, '');
  const rename = renameFlag ?? `${family} Prototype`;
  const watermark = policy.watermark ? watermarkText(family) : undefined;

  let result;
  try {
    result = morph(bytes, { round, width, slant, weight, rename, watermark });
  } catch (e) {
    log.err(`morph failed: ${(e as Error).message}`);
    process.exit(1);
  }

  const bundleDir = join(outDir, slug(rename));
  const fileName = policy.watermark ? `${slug(family)}-prototype.ttf` : `${slug(rename)}.ttf`;
  const outPath = join(bundleDir, fileName);
  try {
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(outPath, result.font);
    writeFileSync(
      join(bundleDir, policy.watermark ? 'MOCKUP_DISCLAIMER.md' : 'NOTICE.md'),
      policy.watermark ? mockupDisclaimer(family) : oflNotice(family, policy.requiresRename),
    );
  } catch (e) {
    log.err(`Could not write output bundle: ${(e as Error).message}`);
    process.exit(1);
  }

  const allWarnings = [...policy.warnings, ...result.warnings];
  if (wantJson) {
    process.stdout.write(
      JSON.stringify(
        {
          input: filePath,
          output: outPath,
          classification: policy.classification,
          applied: result.applied,
          renamedTo: result.renamedTo,
          watermarked: result.watermarked,
          warnings: allWarnings,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    log.info('');
    log.info(`Morphed ${family} → ${outPath}`);
    log.info(
      `  applied: round=${result.applied.round} width=${result.applied.width} slant=${result.applied.slant} weight=${result.applied.weight}`,
    );
    log.info(
      `  ${policy.classification}${result.renamedTo ? ` · renamed to "${result.renamedTo}"` : ''}${result.watermarked ? ' · watermarked' : ''}`,
    );
    for (const w of allWarnings) log.err(`  ⚠ ${w}`);
  }
  process.exit(0);
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
  if (command === 'diff') {
    await runDiff(rest);
    return;
  }
  if (command === 'audit') {
    await runAudit(rest);
    return;
  }
  if (command === 'budget') {
    await runBudget(rest);
    return;
  }
  if (command === 'morph') {
    await runMorph(rest);
    return;
  }

  // Default: legacy `fontfetch <url>` pull behaviour.
  await runPull(args);
}

main().catch((e: unknown) => {
  log.err(String(e));
  process.exit(1);
});
