import type { EmitTarget, Emitter } from './types.js';
import { nextEmitter } from './next.js';
import { tailwindEmitter } from './tailwind.js';
import { viteEmitter } from './vite.js';
import { tokensEmitter } from './tokens.js';

export { isEmitTarget, EMIT_TARGETS } from './types.js';
export type { EmitTarget, Emitter, EmitContext, EmitOutput } from './types.js';

/** css is the default (handled by emit.ts/buildFontsCss); non-css emitters live here. */
export const EMITTERS: Record<Exclude<EmitTarget, 'css'>, Emitter> = {
  next: nextEmitter,
  tailwind: tailwindEmitter,
  vite: viteEmitter,
  tokens: tokensEmitter,
};
