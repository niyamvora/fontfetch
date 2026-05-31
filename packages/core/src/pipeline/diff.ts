import type { FontFace, PullOptions } from '../types.js';
import { pull } from './pull.js';
import { classifyFaces } from '../license/license.js';

export interface DiffSide {
  url: string;
  families: string[];
  totalBytes: number;
  commercialCount: number;
  fileCount: number;
}

export interface FontDiff {
  schemaVersion: '1.0';
  generatedAt: string;
  a: DiffSide;
  b: DiffSide;
  added: string[];
  removed: string[];
  shared: string[];
  byteDelta: number;
  commercialDelta: number;
}

type DiffPullOptions = Omit<PullOptions, 'url' | 'baseDir'>;

/**
 * Run `pull()` on two URLs and produce a structured diff of their @font-face
 * declarations. Pure function — no disk writes. Use `formatFontDiff()` to
 * render markdown.
 */
export async function diffPulls(
  urlA: string,
  urlB: string,
  baseDir: string,
  options: DiffPullOptions = {},
): Promise<FontDiff> {
  const [resultA, resultB] = await Promise.all([
    pull({ url: urlA, baseDir, ...options }),
    pull({ url: urlB, baseDir, ...options }),
  ]);

  const sideA = summarise(urlA, resultA.faces, resultA.fileSizes);
  const sideB = summarise(urlB, resultB.faces, resultB.fileSizes);

  const famSetA = new Set(sideA.families);
  const famSetB = new Set(sideB.families);
  const added = [...famSetB].filter((f) => !famSetA.has(f)).sort();
  const removed = [...famSetA].filter((f) => !famSetB.has(f)).sort();
  const shared = [...famSetA].filter((f) => famSetB.has(f)).sort();

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    a: sideA,
    b: sideB,
    added,
    removed,
    shared,
    byteDelta: sideB.totalBytes - sideA.totalBytes,
    commercialDelta: sideB.commercialCount - sideA.commercialCount,
  };
}

function summarise(
  url: string,
  faces: FontFace[],
  fileSizes: Record<string, number> | undefined,
): DiffSide {
  const families = [...new Set(faces.map((f) => f.family))].sort();
  const sizes = fileSizes ?? {};

  let totalBytes = 0;
  let fileCount = 0;
  const seenFiles = new Set<string>();
  for (const f of faces) {
    for (const s of f.sources) {
      if (!s.localFile) continue;
      if (seenFiles.has(s.localFile)) continue;
      seenFiles.add(s.localFile);
      fileCount++;
      totalBytes += sizes[s.localFile] ?? 0;
    }
  }

  const classified = classifyFaces(faces);
  const commercialCount = classified.filter((c) => c.classification.status === 'commercial').length;

  return { url, families, totalBytes, commercialCount, fileCount };
}

/**
 * Render the diff as terminal-friendly markdown. Designed to be screenshot-
 * able and to fit in a GitHub Action PR comment.
 */
export function formatFontDiff(diff: FontDiff): string {
  const lines: string[] = [
    `# Font diff`,
    '',
    `- **A** ${diff.a.url}`,
    `- **B** ${diff.b.url}`,
    '',
    `## Summary`,
    '',
    `- Added: ${diff.added.length} family/families`,
    `- Removed: ${diff.removed.length} family/families`,
    `- Shared: ${diff.shared.length} family/families`,
    `- Byte delta: ${formatBytes(diff.byteDelta)}`,
    `- Commercial delta: ${signed(diff.commercialDelta)} face(s)`,
    '',
  ];

  if (diff.added.length > 0) {
    lines.push('## Added (only in B)');
    lines.push('');
    for (const f of diff.added) lines.push(`- ${f}`);
    lines.push('');
  }

  if (diff.removed.length > 0) {
    lines.push('## Removed (only in A)');
    lines.push('');
    for (const f of diff.removed) lines.push(`- ${f}`);
    lines.push('');
  }

  if (diff.shared.length > 0) {
    lines.push('## Shared');
    lines.push('');
    for (const f of diff.shared) lines.push(`- ${f}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatBytes(bytes: number): string {
  const sign = bytes >= 0 ? '+' : '−';
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${sign}${abs} B`;
  if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(1)} KB`;
  return `${sign}${(abs / (1024 * 1024)).toFixed(1)} MB`;
}

function signed(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}
