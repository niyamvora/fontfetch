import type { FontFace } from '../types.js';
import { OPEN_HOSTS, COMMERCIAL_HOSTS, KNOWN_OPEN_FAMILIES } from './license-data.js';

export type LicenseStatus = 'open' | 'commercial' | 'unknown';

export interface LicenseClassification {
  status: LicenseStatus;
  reason: string;
}

const NORMALIZED_OPEN_FAMILIES = new Set(KNOWN_OPEN_FAMILIES.map((f) => f.trim().toLowerCase()));

/**
 * Classify a single face. URL signatures win over family-name signatures —
 * if a font is served from a commercial CDN we mark it commercial even if
 * the family name matches an open family (someone selling Inter on Typekit
 * is still selling Inter).
 */
export function classifyFace(face: FontFace): LicenseClassification {
  for (const src of face.sources) {
    for (const sig of COMMERCIAL_HOSTS) {
      if (src.url.includes(sig.host)) {
        return { status: 'commercial', reason: `Served from ${sig.label}` };
      }
    }
  }

  for (const src of face.sources) {
    for (const sig of OPEN_HOSTS) {
      if (src.url.includes(sig.host)) {
        return { status: 'open', reason: `Served from ${sig.label}` };
      }
    }
  }

  const fam = (face.family || '').trim().toLowerCase();
  if (NORMALIZED_OPEN_FAMILIES.has(fam)) {
    return { status: 'open', reason: `'${face.family}' is on the SIL OFL / Google Fonts catalog` };
  }

  return { status: 'unknown', reason: 'No matching CDN or known-family signature' };
}

export interface ClassifiedFace {
  face: FontFace;
  classification: LicenseClassification;
}

export function classifyFaces(faces: FontFace[]): ClassifiedFace[] {
  return faces.map((face) => ({ face, classification: classifyFace(face) }));
}

export interface LicenseSummary {
  open: number;
  commercial: number;
  unknown: number;
  total: number;
  /** True if at least one face was classified AND all classifications are commercial. */
  allCommercial: boolean;
}

export function summarize(classified: ClassifiedFace[]): LicenseSummary {
  let open = 0;
  let commercial = 0;
  let unknown = 0;
  for (const c of classified) {
    if (c.classification.status === 'open') open++;
    else if (c.classification.status === 'commercial') commercial++;
    else unknown++;
  }
  const total = classified.length;
  return {
    open,
    commercial,
    unknown,
    total,
    allCommercial: total > 0 && commercial === total,
  };
}
