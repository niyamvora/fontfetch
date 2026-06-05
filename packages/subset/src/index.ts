/**
 * `@fontfetch/subset` — DOM-driven subsetting + per-language range splitting.
 *
 * v1.5.x package split, interface-first: re-exports the subset surface from
 * `@fontfetch/core` to establish the public import boundary now. Physical
 * relocation out of core is deferred (see the v1.5.x roadmap entry).
 */
export { subset } from '@fontfetch/core';
export type { SubsetReport, SubsetFileReport, SubsetOptions, SplitFamilyReport } from '@fontfetch/core';
