/**
 * Public API for `@fontfetch/core`.
 *
 * Consumed by:
 *  - `fontfetch` (the CLI in packages/cli)
 *  - `apps/web` (the fontfetch.dev Next.js webapp; `/api/pull` Route Handler)
 *  - `apps/worker` (the Playwright headless service)
 *
 * Everything exported here is part of the supported surface. Internal helpers
 * (e.g. raw parser helpers under `./parse/`, low-level utilities under
 * `./lib/`) should stay un-re-exported here and only be imported via deep
 * paths inside the workspace.
 *
 * Imports go through each subfolder's `index.ts` barrel. New files inside a
 * folder don't require changes here — re-export them from the folder barrel
 * (and add a line below only if they should be part of the public surface).
 *
 * `headless` is intentionally not re-exported from the root entry to keep
 * the `playwright` peer dependency truly optional — import it from
 * `@fontfetch/core/headless` instead.
 */

export { pull } from './pipeline/index.js';
export type {
  PullOptions,
  PullResult,
  PullProgressEvent,
  FontFace,
  FontFormat,
  FontSource,
  OrphanFile,
  CssSource,
} from './types.js';

export {
  FONT_FORMATS,
  isFontFormat,
  resolveFormat,
  filterFacesByFormat,
  urlMatchesFormat,
} from './formats/index.js';

export {
  parseUnicodeRange,
  formatUnicodeRange,
  GOOGLE_FONTS_RANGES,
  MIN_GLYPHS_PER_BUCKET,
  expandBucket,
} from './formats/index.js';
export type { UnicodeRangeBucket } from './formats/index.js';

export {
  classifyFace,
  classifyFaces,
  summarize,
} from './license/index.js';
export type {
  LicenseStatus,
  LicenseClassification,
  ClassifiedFace,
  LicenseSummary,
} from './license/index.js';

export { bucketForUrl, sameOrigin, BUCKETS } from './license/index.js';
export type { Bucket } from './license/index.js';

export {
  buildFontsCss,
  buildFontsJson,
  buildReadme,
  buildLicenseReview,
} from './emit/index.js';

export {
  EMITTERS,
  EMIT_TARGETS,
  isEmitTarget,
} from './emit/index.js';
export type {
  EmitTarget,
  Emitter,
  EmitContext,
  EmitOutput,
} from './emit/index.js';

export { log } from './lib/index.js';

export {
  inspect,
  formatInspectionReport,
  summarizeVariableFonts,
  formatAxesInline,
} from './inspect/index.js';
export type { InspectionReport, VariationAxis, VariableFontSummary } from './inspect/index.js';

export {
  discoverInternalLinks,
  CRAWL_PAGE_CAP,
} from './parse/index.js';
export type { CrawlOptions } from './parse/index.js';

export {
  isNextjsSubsetUrl,
  parseNextjsSubsetUrl,
  nextjsSiblingCandidates,
  probeNextjsSiblings,
} from './platforms/index.js';
export type { NextjsSubsetMatch } from './platforms/index.js';

export {
  computeFallback,
  formatFallbackCss,
  buildFallbacksForDir,
  pickGenericFallback,
} from './inspect/index.js';
export type { FallbackMetrics, FallbackGenericFamily } from './inspect/index.js';

export { subset } from './pipeline/index.js';
export type {
  SubsetReport,
  SubsetFileReport,
  SubsetOptions,
  SplitFamilyReport,
} from './pipeline/index.js';
