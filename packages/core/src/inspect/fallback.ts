import fs from 'node:fs/promises';
import path from 'node:path';
import { fromBuffer } from '@capsizecss/unpack';
import { createFontStack } from '@capsizecss/core';
import * as fontkit from 'fontkit';

export type FallbackGenericFamily = 'sans-serif' | 'serif' | 'monospace';

export interface FallbackMetrics {
  familyName: string;
  fallbackFamily: string;
  generic: FallbackGenericFamily;
  /** Percentage strings exactly as Capsize emits them. */
  sizeAdjust: string;
  ascentOverride: string;
  descentOverride: string;
  lineGapOverride: string;
}

interface FontMetrics {
  familyName: string;
  category?: string;
  capHeight: number;
  ascent: number;
  descent: number;
  lineGap: number;
  unitsPerEm: number;
  xHeight: number;
  xWidthAvg: number;
}

/**
 * System fallback metric tables. These values are the Capsize-published
 * metrics for the canonical platform fallbacks; bundling them keeps
 * `--fallback` working offline and without an extra metrics dependency.
 *
 * Source: @capsizecss/metrics — kept inline because we only need three.
 */
const SYSTEM_FALLBACKS: Record<FallbackGenericFamily, FontMetrics> = {
  'sans-serif': {
    familyName: 'Arial',
    category: 'sans-serif',
    capHeight: 1467,
    ascent: 1854,
    descent: -434,
    lineGap: 67,
    unitsPerEm: 2048,
    xHeight: 1062,
    xWidthAvg: 904,
  },
  serif: {
    familyName: 'Times New Roman',
    category: 'serif',
    capHeight: 1356,
    ascent: 1825,
    descent: -443,
    lineGap: 87,
    unitsPerEm: 2048,
    xHeight: 916,
    xWidthAvg: 776,
  },
  monospace: {
    familyName: 'Courier New',
    category: 'monospace',
    capHeight: 1170,
    ascent: 1705,
    descent: -615,
    lineGap: 0,
    unitsPerEm: 2048,
    xHeight: 866,
    xWidthAvg: 1228,
  },
};

const MONO_NAME_RE = /\b(mono|code|console|typewriter)\b/i;
const SERIF_NAME_RE = /\b(serif|antiqua|garamond|times|caslon|baskerville|bodoni|didot|georgia)\b/i;

export interface PickGenericFallbackHint {
  /** From the binary's `post` table. When true, force `monospace` regardless of the family name. Catches monospace families whose name doesn't say "mono" (Operator, PragmataPro, Comic Code). */
  isFixedPitch?: boolean;
}

export function pickGenericFallback(
  familyName: string,
  hint: PickGenericFallbackHint = {},
): FallbackGenericFamily {
  if (hint.isFixedPitch === true) return 'monospace';
  if (MONO_NAME_RE.test(familyName)) return 'monospace';
  if (SERIF_NAME_RE.test(familyName)) return 'serif';
  return 'sans-serif';
}

/**
 * Read `post.isFixedPitch` from a font buffer via fontkit. Returns `false`
 * on any failure — the caller falls back to the family-name heuristic.
 * Cheap: fontkit is already a runtime dep used by `inspect` and the
 * variable-font summariser.
 */
function readIsFixedPitchFromBuffer(buffer: Buffer): boolean {
  try {
    const opened = (fontkit as unknown as { create: (b: Buffer) => unknown }).create(buffer);
    const font = (
      opened && typeof opened === 'object' && 'fonts' in opened
        ? (opened as { fonts: Array<{ post?: { isFixedPitch?: boolean | number } }> }).fonts[0]
        : (opened as { post?: { isFixedPitch?: boolean | number } })
    );
    const raw = font?.post?.isFixedPitch;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    return false;
  } catch {
    return false;
  }
}

/**
 * Compute the CLS-killing `@font-face` block parameters for a single font.
 * Inputs: a font binary path on disk. Output: the four override percentages
 * a browser uses to make the system fallback match the primary's metrics
 * before the primary loads.
 */
export async function computeFallback(
  filePath: string,
  options: { generic?: FallbackGenericFamily; fallbackName?: string } = {},
): Promise<FallbackMetrics> {
  const abs = path.resolve(filePath);
  const buffer = await fs.readFile(abs);
  const raw = await fromBuffer(buffer);

  // v1.3.1: cross-check the post table before the name regex so monospace
  // families with non-obvious names (Operator, PragmataPro, Comic Code) get
  // Courier New as their CLS fallback instead of Arial.
  const isFixedPitch = readIsFixedPitchFromBuffer(buffer);
  const generic =
    options.generic ?? pickGenericFallback(raw.familyName, { isFixedPitch });
  const fallback = SYSTEM_FALLBACKS[generic];

  const stack = createFontStack(
    [
      {
        familyName: raw.familyName,
        capHeight: raw.capHeight,
        ascent: raw.ascent,
        descent: raw.descent,
        lineGap: raw.lineGap,
        unitsPerEm: raw.unitsPerEm,
        xHeight: raw.xHeight,
        xWidthAvg: raw.xWidthAvg,
      },
      fallback,
    ],
    {
      fontFaceFormat: 'styleObject',
    },
  );

  // styleObject mode emits one `{ '@font-face': { ... } }` entry per fallback;
  // we passed exactly one fallback so we take the first.
  const faceEntry = stack.fontFaces[0] as { '@font-face': Record<string, string | undefined> };
  const props = faceEntry['@font-face'];
  return {
    familyName: raw.familyName,
    fallbackFamily: options.fallbackName ?? `${raw.familyName} Fallback`,
    generic,
    sizeAdjust: props.sizeAdjust ?? '100%',
    ascentOverride: props.ascentOverride ?? 'normal',
    descentOverride: props.descentOverride ?? 'normal',
    lineGapOverride: props.lineGapOverride ?? 'normal',
  };
}

export function formatFallbackCss(metrics: FallbackMetrics): string {
  const lines = [
    `/* CLS-killing fallback for ${metrics.familyName} — generated by fontfetch */`,
    `@font-face {`,
    `  font-family: '${metrics.fallbackFamily}';`,
    `  src: local('${SYSTEM_FALLBACKS[metrics.generic].familyName}');`,
    `  size-adjust: ${metrics.sizeAdjust};`,
    `  ascent-override: ${metrics.ascentOverride};`,
    `  descent-override: ${metrics.descentOverride};`,
    `  line-gap-override: ${metrics.lineGapOverride};`,
    `}`,
  ];
  return lines.join('\n');
}

/**
 * Best-effort: scan a directory of font files, compute a fallback block per
 * unique family, and concatenate them. Used by `fontfetch --fallback` so the
 * emitted `fonts.css` ships with a matching `Fallback` face for every face.
 */
export async function buildFallbacksForDir(
  filesDir: string,
): Promise<{ css: string; count: number; errors: { file: string; reason: string }[] }> {
  let entries: string[];
  try {
    entries = await collectFontFiles(filesDir);
  } catch (e) {
    return { css: '', count: 0, errors: [{ file: filesDir, reason: (e as Error).message }] };
  }

  const seen = new Set<string>();
  const blocks: string[] = [];
  const errors: { file: string; reason: string }[] = [];

  for (const file of entries) {
    try {
      const m = await computeFallback(file);
      if (seen.has(m.familyName)) continue;
      seen.add(m.familyName);
      blocks.push(formatFallbackCss(m));
    } catch (e) {
      errors.push({ file, reason: (e as Error).message });
    }
  }

  return { css: blocks.join('\n\n'), count: blocks.length, errors };
}

async function collectFontFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) {
        await walk(p);
      } else if (/\.(woff2|woff|ttf|otf)$/i.test(it.name)) {
        out.push(p);
      }
    }
  }
  await walk(root);
  return out;
}
