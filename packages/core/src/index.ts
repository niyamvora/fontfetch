/**
 * Public API for `@fontfetch/core`.
 *
 * Consumed by:
 *  - `fontfetch` (the CLI in packages/cli)
 *  - `apps/web` (the fontfetch.dev Next.js webapp; `/api/pull` Route Handler)
 *  - `apps/worker` (the Playwright headless service)
 *
 * Everything exported here is part of the supported surface. Internal helpers
 * (e.g. raw `parse.ts` / `utils.ts` functions) should stay un-re-exported and
 * be imported via deep paths only inside the workspace.
 *
 * `headless` is intentionally not re-exported from the root entry to keep the
 * `playwright` peer dependency truly optional — import it from
 * `@fontfetch/core/headless` instead.
 */

export { pull } from './pull.js';
export type {
  PullOptions,
  PullResult,
  PullProgressEvent,
  FontFace,
  FontSource,
  OrphanFile,
  CssSource,
} from './types.js';

export {
  classifyFace,
  classifyFaces,
  summarize,
} from './license.js';
export type {
  LicenseStatus,
  LicenseClassification,
  ClassifiedFace,
  LicenseSummary,
} from './license.js';

export { bucketForUrl, sameOrigin, BUCKETS } from './provenance.js';
export type { Bucket } from './provenance.js';

export {
  buildFontsCss,
  buildFontsJson,
  buildReadme,
  buildLicenseReview,
} from './emit.js';

export {
  EMITTERS,
  EMIT_TARGETS,
  isEmitTarget,
} from './emitters/index.js';
export type {
  EmitTarget,
  Emitter,
  EmitContext,
  EmitOutput,
} from './emitters/index.js';

export { log } from './utils.js';

export {
  inspect,
  formatInspectionReport,
  summarizeVariableFonts,
  formatAxesInline,
} from './inspect.js';
export type { InspectionReport, VariationAxis, VariableFontSummary } from './inspect.js';

export {
  discoverInternalLinks,
  CRAWL_PAGE_CAP,
} from './crawl.js';
export type { CrawlOptions } from './crawl.js';

export {
  isNextjsSubsetUrl,
  parseNextjsSubsetUrl,
  nextjsSiblingCandidates,
  probeNextjsSiblings,
} from './nextjs.js';
export type { NextjsSubsetMatch } from './nextjs.js';

export {
  computeFallback,
  formatFallbackCss,
  buildFallbacksForDir,
  pickGenericFallback,
} from './fallback.js';
export type { FallbackMetrics, FallbackGenericFamily } from './fallback.js';

export { subset } from './subset.js';
export type { SubsetReport, SubsetFileReport, SubsetOptions } from './subset.js';
