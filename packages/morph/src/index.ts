/**
 * `@fontfetch/morph` — prototyping-grade parametric font morphing.
 *
 * Take any font outline, round / widen / slant / thicken it, and write a real
 * binary back out. Built for pre-commission ideation — a typography sketchbook,
 * not a production type-design tool. See the package README for scope and the
 * licensing posture that gates the CLI surface in a later step.
 */
export { morph } from './morph.js';
export { loadFont, saveFont, readGlyphCommands, writeGlyphCommands, glyphCount } from './io.js';
export { widthTransform, slantTransform, roundTransform, weightTransform } from './transforms/index.js';
export { renameFamily, applyWatermark, watermarkText, readFamily, readVendor } from './naming.js';
export {
  resolvePosture,
  decideMorphPolicy,
  checkBlocklist,
  morphBlocklist,
} from './posture.js';

export type {
  MorphOptions,
  MorphResult,
  AppliedMorph,
  PathCommand,
  GlyphTransform,
} from './types.js';
export type {
  MorphPosture,
  MorphPolicy,
  MorphClassification,
  FontLicenseSignal,
  FoundrySignature,
} from './posture.js';
