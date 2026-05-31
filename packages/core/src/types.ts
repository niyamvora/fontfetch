import type { VariableFontSummary } from './inspect/inspect.js';

/**
 * Canonical font formats fontfetch emits. CSS `format(...)` aliases
 * (`truetype` → `ttf`, `opentype` → `otf`, `embedded-opentype` → `eot`)
 * are normalised onto this union in `formats.ts`.
 */
export type FontFormat = 'woff2' | 'woff' | 'ttf' | 'otf' | 'eot';

export interface FontSource {
  url: string;
  format: string | null;
  localFile?: string;
}

export interface FontFace {
  family: string;
  weight: string;
  style: string;
  display: string | null;
  unicodeRange: string | null;
  sources: FontSource[];
}

export interface PullOptions {
  url: string;
  baseDir: string;
  headless?: boolean;
  /** Framework targets to emit alongside the default css output. */
  emit?: ('next' | 'tailwind' | 'vite' | 'tokens')[];
  /**
   * Skip the fail-fast check that aborts when every detected font URL points
   * at a known commercial-foundry CDN. Useful when the user knows what they're
   * doing — local mockup work, redownloading their own purchased license, etc.
   */
  force?: boolean;
  /**
   * Optional structured progress callback. The CLI ignores it (its progress
   * is shown via stdout). The fontfetch.dev webapp uses it to stream Server-
   * Sent Events to the browser stepper. Always optional and backward-
   * compatible — pull() behaves identically with or without it.
   */
  onProgress?: (event: PullProgressEvent) => void;
  /**
   * Emit CLS-killing `@font-face` fallback blocks alongside the primary
   * faces. For each detected family we read the downloaded binary's metrics
   * via capsize/unpack, pick a generic system fallback (Arial / Times New
   * Roman / Courier New) based on the family name, and emit a `<family>
   * Fallback` face with `size-adjust` / `ascent-override` /
   * `descent-override` / `line-gap-override` matched to the primary's
   * metrics. The emitted `fonts.css` then chains `'<Family>', '<Family>
   * Fallback', <generic>` so the browser swaps between visually identical
   * boxes during the font load.
   */
  fallback?: boolean;
  /**
   * Crawl up to N pages starting from `url` and merge the fonts seen across
   * all of them. Defaults to `1` (entry page only — the v1.0 behaviour).
   * Capped at 50 to keep runtime bounded. Useful when a homepage uses a
   * different family from /blog or /pricing.
   */
  pages?: number;
  /**
   * Restrict the emitted faces and downloaded files to a subset of formats.
   * Each face's `src:` list is filtered to keep only entries whose resolved
   * format is in this allowlist; a face whose every source is filtered out
   * is dropped (with a warning) rather than emitted broken. Default
   * (`undefined`) preserves the v1.2 behaviour of keeping every format the
   * upstream CSS provides. Common value: `['woff2']` for modern-only output
   * — closes the v1.2 gap surfaced by glyphhanger #8.
   */
  formats?: FontFormat[];
  /**
   * v1.4: emit a `GDPR.md` privacy review file alongside the standard
   * outputs. Lists every third-party font request with a one-line
   * self-hosting remediation per family. Driven by the post-LG München I
   * 20 O 1393/21 (2022) German court ruling on Google Fonts CDN.
   */
  gdprReport?: boolean;
}

/**
 * Structured progress events emitted by `pull()` when `onProgress` is set.
 * Designed to map cleanly onto the SSE schema in apps/web — keep the union
 * shape stable; add new variants rather than mutating existing ones.
 */
export type PullProgressEvent =
  | { type: 'phase'; phase: 'fetch_html' | 'parse_css' | 'extract_faces' | 'download' | 'classify' | 'done' | 'crawl' | 'probe_nextjs' | 'inspect_variable' }
  | { type: 'page_fetched'; url: string; index: number; total: number }
  | { type: 'page_failed'; url: string; reason: string }
  | { type: 'css_fetched'; url: string }
  | { type: 'css_failed'; url: string; reason: string }
  | { type: 'faces_found'; count: number; files: number }
  | { type: 'file_downloaded'; name: string; bucket: string; bytes: number; index: number; total: number }
  | { type: 'file_failed'; name: string; reason: string }
  | { type: 'orphan'; url: string; file: string }
  | { type: 'nextjs_siblings'; sourceUrl: string; discovered: number }
  | { type: 'variable_fonts'; fonts: VariableFontSummary[] }
  | { type: 'empty_help_hinted' }
  | { type: 'classified'; open: number; commercial: number; unknown: number }
  | { type: 'aborted_all_commercial'; count: number }
  | { type: 'done'; downloaded: number; total: number; outDir: string };

export interface OrphanFile {
  url: string;
  file: string;
}

export interface PullResult {
  outDir: string;
  faces: FontFace[];
  orphans: OrphanFile[];
  downloaded: number;
  total: number;
  /**
   * One entry per variable font detected on disk after download. Empty when
   * no downloads happened or when none of the binaries expose variation
   * axes. Populated by `pull()` via `summarizeVariableFonts()`.
   */
  variableFonts: VariableFontSummary[];
  /** Pages successfully fetched during the crawl. Always >= 1. */
  pagesCrawled: number;
  /** URLs discovered via the Next.js subset sibling probe. */
  discoveredNextjsSiblings: string[];
  /**
   * v1.4: cross-page consistency report. Present only when more than one page
   * was crawled (`pages > 1`). Lists shared families, per-page family sets,
   * and divergent pages.
   */
  consistency?: {
    shared: string[];
    perPage: { url: string; families: string[] }[];
    divergent: { url: string; onlyHere: string[]; missingHere: string[] }[];
  };
  /**
   * v1.4: per-file size map keyed by the local file name (relative to
   * `files/`). Populated as downloads succeed. Consumed by audit/budget
   * subcommands and the provenance.json emitter.
   */
  fileSizes?: Record<string, number>;
  /**
   * v1.4: families that ship both a variable font and 2+ static weight
   * files. Dropping the statics in favour of the variable saves bundle
   * size with no visual loss. Populated when at least one opportunity
   * exists; empty array otherwise.
   */
  collapseOpportunities?: Array<{
    family: string;
    variableFile: string;
    variableBytes: number;
    staticBytes: number;
    savedBytes: number;
    staticFiles: Array<{ file: string; bytes: number; weight: string; style: string }>;
  }>;
}

export interface CssSource {
  text: string;
  base: string;
}
