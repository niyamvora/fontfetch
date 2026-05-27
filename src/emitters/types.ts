import type { FontFace } from '../types.js';

export interface EmitContext {
  /** Hostname-derived slug, e.g. 'stripe-com' (used for variable names) */
  siteSlug: string;
  /** Path (relative to the output dir) where font files live. Default: 'files' */
  filesDir: string;
}

export interface EmitOutput {
  /** File written into the per-site output dir (e.g. 'next.fonts.ts') */
  filename: string;
  /** Full file contents */
  content: string;
}

export type Emitter = (faces: FontFace[], context: EmitContext) => EmitOutput | null;

export type EmitTarget = 'css' | 'next' | 'tailwind' | 'vite';

export const EMIT_TARGETS: EmitTarget[] = ['css', 'next', 'tailwind', 'vite'];

export function isEmitTarget(s: string): s is EmitTarget {
  return (EMIT_TARGETS as string[]).includes(s);
}
