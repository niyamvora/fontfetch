/**
 * `@fontfetch/inspect` — terminal-native font inspection.
 *
 * v1.5.x package split, interface-first. This package establishes the public
 * import boundary today by re-exporting the inspection surface from
 * `@fontfetch/core`; the physical relocation of the implementation out of core
 * is deferred (tracked in the v1.5.x roadmap entry). Importers can depend on
 * `@fontfetch/inspect` now and survive the later move unchanged.
 */
export {
  inspect,
  formatInspectionReport,
  summarizeVariableFonts,
  formatAxesInline,
} from '@fontfetch/core';
export type { InspectionReport, VariationAxis, VariableFontSummary } from '@fontfetch/core';
