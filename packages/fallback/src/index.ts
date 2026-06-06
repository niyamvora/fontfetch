/**
 * `@fontfetch/fallback` — CLS-killing fallback metrics + collapse hints.
 *
 * v1.5.x package split, interface-first: re-exports the fallback surface from
 * `@fontfetch/core` to establish the public import boundary now. Physical
 * relocation out of core is deferred (see the v1.5.x roadmap entry).
 */
export {
  computeFallback,
  formatFallbackCss,
  buildFallbacksForDir,
  pickGenericFallback,
  detectCollapseOpportunities,
  formatCollapseHint,
} from '@fontfetch/core';
export type { FallbackMetrics, FallbackGenericFamily, CollapseOpportunity } from '@fontfetch/core';
