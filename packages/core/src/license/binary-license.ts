import path from 'node:path';
import fs from 'node:fs/promises';
import type { ClassifiedFace } from './license.js';
import { inspect } from '../inspect/inspect.js';

/**
 * v1.3.1: refine classifications using the OpenType `name` table fields the
 * font itself declares (id 13 = license description, id 14 = license URL).
 *
 * Promotion rules — conservative on purpose. URL-signature classifications
 * still win; this pass only adds signal, never removes it:
 *
 *   - `unknown` + binary self-declares OFL  → flip to `open`
 *   - `unknown` + non-OFL                    → stay `unknown` (don't false-commercial)
 *   - `commercial` (URL signature)           → never demote, never flip
 *   - `open` (URL signature or catalog)      → preserved; RFN flag attached
 *
 * RFN attachment runs on every face whose binary self-declares OFL with the
 * Reserved Font Name clause, regardless of the original classification —
 * the surface is in `LICENSE_REVIEW.md`, not in the status itself.
 */
export async function crossRefLicenseFromBinaries(
  classified: ClassifiedFace[],
  filesDir: string,
): Promise<ClassifiedFace[]> {
  const out: ClassifiedFace[] = [];

  for (const c of classified) {
    const primary = c.face.sources.find((s) => s.localFile);
    if (!primary?.localFile) {
      out.push(c);
      continue;
    }
    const abs = path.join(filesDir, primary.localFile);
    try {
      await fs.access(abs);
    } catch {
      out.push(c);
      continue;
    }

    try {
      const report = await inspect(abs);
      const next = { ...c, classification: { ...c.classification } };

      if (
        next.classification.status === 'unknown' &&
        report.license.isOFL
      ) {
        next.classification.status = 'open';
        next.classification.reason = report.license.url
          ? `Self-declares OFL in name table (${report.license.url})`
          : 'Self-declares OFL in name table';
      }

      if (report.license.hasRFN) {
        next.classification.hasRFN = true;
      }

      out.push(next);
    } catch {
      out.push(c);
    }
  }

  return out;
}
