import type { FontFace, PullOptions } from '../types.js';
import { pull } from './pull.js';
import { classifyFaces } from '../license/license.js';

export interface AuditOptions {
  /** Total bundle byte budget. If exceeded, the audit fails. */
  maxKb?: number;
  /** Per-family byte budget. Map of family → max KB. */
  perFamilyKb?: Record<string, number>;
  /** Fail if any face classifies as commercial. */
  noCommercial?: boolean;
  /** Fail if any face has the OFL RFN clause AND wasn't already renamed. */
  noRFN?: boolean;
  /** Pull options forwarded to the underlying pipeline call. */
  pull?: Omit<PullOptions, 'url' | 'baseDir'>;
}

export interface AuditViolation {
  type: 'budget_exceeded' | 'family_budget_exceeded' | 'commercial_present' | 'rfn_present';
  message: string;
  /** Field-specific detail. */
  detail?: Record<string, string | number>;
}

export interface AuditReport {
  schemaVersion: '1.0';
  generatedAt: string;
  url: string;
  passed: boolean;
  violations: AuditViolation[];
  summary: {
    families: number;
    faces: number;
    files: number;
    totalBytes: number;
    byStatus: { open: number; commercial: number; unknown: number };
    perFamilyBytes: Record<string, number>;
  };
}

/**
 * Run a pull and check the result against a set of CI-friendly budgets and
 * rules. Returns a structured report; the caller (CLI) decides the exit code.
 *
 * Designed for `fontfetch audit` and the upcoming `fontfetch-action`. The
 * report shape is stable from v1.4.0 onward.
 */
export async function audit(
  url: string,
  baseDir: string,
  options: AuditOptions = {},
): Promise<AuditReport> {
  const result = await pull({ url, baseDir, ...options.pull });
  const classified = classifyFaces(result.faces);
  const sizes = result.fileSizes ?? {};

  const perFamilyBytes = perFamily(result.faces, sizes);
  const totalBytes = Object.values(perFamilyBytes).reduce((a, b) => a + b, 0);
  const files = countFiles(result.faces);

  const byStatus = { open: 0, commercial: 0, unknown: 0 };
  for (const c of classified) byStatus[c.classification.status]++;

  const violations: AuditViolation[] = [];

  if (options.maxKb !== undefined && totalBytes / 1024 > options.maxKb) {
    violations.push({
      type: 'budget_exceeded',
      message: `Total font bundle is ${(totalBytes / 1024).toFixed(1)} KB, exceeds budget of ${options.maxKb} KB`,
      detail: { actualKb: Math.round(totalBytes / 1024), budgetKb: options.maxKb },
    });
  }

  if (options.perFamilyKb) {
    for (const [family, budget] of Object.entries(options.perFamilyKb)) {
      const actual = perFamilyBytes[family] ?? 0;
      if (actual / 1024 > budget) {
        violations.push({
          type: 'family_budget_exceeded',
          message: `Family "${family}" is ${(actual / 1024).toFixed(1)} KB, exceeds budget of ${budget} KB`,
          detail: { family, actualKb: Math.round(actual / 1024), budgetKb: budget },
        });
      }
    }
  }

  if (options.noCommercial && byStatus.commercial > 0) {
    const offenders = classified
      .filter((c) => c.classification.status === 'commercial')
      .map((c) => c.face.family);
    violations.push({
      type: 'commercial_present',
      message: `${byStatus.commercial} commercial face(s) detected: ${[...new Set(offenders)].join(', ')}`,
      detail: { count: byStatus.commercial, families: [...new Set(offenders)].join(', ') },
    });
  }

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    url,
    passed: violations.length === 0,
    violations,
    summary: {
      families: new Set(result.faces.map((f) => f.family)).size,
      faces: result.faces.length,
      files,
      totalBytes,
      byStatus,
      perFamilyBytes,
    },
  };
}

function perFamily(faces: FontFace[], sizes: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const seenFiles = new Set<string>();
  for (const f of faces) {
    let familyBytes = 0;
    for (const s of f.sources) {
      if (!s.localFile) continue;
      if (seenFiles.has(s.localFile)) continue;
      seenFiles.add(s.localFile);
      familyBytes += sizes[s.localFile] ?? 0;
    }
    out[f.family] = (out[f.family] ?? 0) + familyBytes;
  }
  return out;
}

function countFiles(faces: FontFace[]): number {
  const seen = new Set<string>();
  for (const f of faces) {
    for (const s of f.sources) {
      if (s.localFile) seen.add(s.localFile);
    }
  }
  return seen.size;
}

/**
 * Render an audit report as human-readable terminal output. Used by the CLI
 * `audit` subcommand and the `fontfetch-action` PR comment.
 */
export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`# Audit: ${report.url}`);
  lines.push('');
  if (report.passed) {
    lines.push(`✓ Passed. ${report.summary.faces} face(s), ${(report.summary.totalBytes / 1024).toFixed(1)} KB total.`);
  } else {
    lines.push(`✗ Failed with ${report.violations.length} violation(s).`);
    lines.push('');
    for (const v of report.violations) {
      lines.push(`- **${v.type}**: ${v.message}`);
    }
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Families: ${report.summary.families}`);
  lines.push(`- Faces: ${report.summary.faces}`);
  lines.push(`- Files: ${report.summary.files}`);
  lines.push(`- Total bytes: ${(report.summary.totalBytes / 1024).toFixed(1)} KB`);
  lines.push(
    `- License: ${report.summary.byStatus.open} open / ${report.summary.byStatus.commercial} commercial / ${report.summary.byStatus.unknown} unknown`,
  );
  return lines.join('\n');
}
