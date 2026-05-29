import path from 'node:path';
import type { FontFace } from '../types.js';
import type { VariableFontSummary } from './inspect.js';

export interface CollapseOpportunity {
  family: string;
  /** Path of the variable font that could replace the statics. */
  variableFile: string;
  /** Bytes the variable font occupies. */
  variableBytes: number;
  /** Static-weight files that would become redundant. */
  staticFiles: Array<{ file: string; bytes: number; weight: string; style: string }>;
  /** Sum of static file bytes. */
  staticBytes: number;
  /** staticBytes - variableBytes. Positive when keeping the variable saves space. */
  savedBytes: number;
}

/**
 * v1.4: detect families that ship both a variable font AND >= 2 static
 * weight files. The variable font already covers every weight in its
 * `wght` axis range; the statics are redundant and just add bundle size.
 *
 * Returns one opportunity per family where the collapse would actually
 * save bytes. Used by the CLI to surface a one-liner after the pull
 * summary; also surfaced on `PullResult.collapseOpportunities` for
 * non-CLI consumers (the webapp can show a "click to optimise" CTA).
 */
export function detectCollapseOpportunities(
  variableFonts: VariableFontSummary[],
  faces: FontFace[],
  fileSizes: Map<string, number>,
): CollapseOpportunity[] {
  const out: CollapseOpportunity[] = [];

  for (const vf of variableFonts) {
    const hasWeightAxis = vf.axes.some((a) => a.tag === 'wght' && a.min !== a.max);
    if (!hasWeightAxis) continue;

    // Collect static-weight files for the same family that aren't the variable binary itself.
    const variableFileName = path.basename(vf.filePath);
    const staticFiles = new Map<string, { weight: string; style: string }>();
    for (const f of faces) {
      if (f.family !== vf.family) continue;
      for (const s of f.sources) {
        if (!s.localFile) continue;
        const baseName = path.basename(s.localFile);
        if (baseName === variableFileName) continue;
        // Skip subsets — they're a different optimisation (unicode-range).
        if (/\.subset\./i.test(baseName)) continue;
        staticFiles.set(s.localFile, { weight: f.weight, style: f.style });
      }
    }

    if (staticFiles.size < 2) continue; // not worth collapsing one or zero statics

    const variableLocalKey = findLocalKeyForFile(faces, variableFileName);
    const variableBytes = variableLocalKey ? fileSizes.get(variableLocalKey) ?? 0 : 0;
    const staticEntries: CollapseOpportunity['staticFiles'] = [];
    let staticBytes = 0;
    for (const [file, meta] of staticFiles) {
      const bytes = fileSizes.get(file) ?? 0;
      staticBytes += bytes;
      staticEntries.push({ file, bytes, weight: meta.weight, style: meta.style });
    }

    const savedBytes = staticBytes - variableBytes;
    if (savedBytes <= 0) continue; // only flag when collapse would actually save bytes

    out.push({
      family: vf.family,
      variableFile: vf.filePath,
      variableBytes,
      staticFiles: staticEntries,
      staticBytes,
      savedBytes,
    });
  }

  return out;
}

function findLocalKeyForFile(faces: FontFace[], baseName: string): string | undefined {
  for (const f of faces) {
    for (const s of f.sources) {
      if (s.localFile && path.basename(s.localFile) === baseName) {
        return s.localFile;
      }
    }
  }
  return undefined;
}

/**
 * Human-readable one-liner per opportunity. Used by the CLI after the
 * variable-font hint block.
 */
export function formatCollapseHint(op: CollapseOpportunity): string {
  const savedKb = (op.savedBytes / 1024).toFixed(1);
  return `  ℹ ${op.family}: drop ${op.staticFiles.length} static weight file(s) — variable font already covers them. Saves ~${savedKb} KB.`;
}
