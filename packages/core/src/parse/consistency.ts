import type { FontFace } from '../types.js';

export interface PageFaceMap {
  /** The page URL that referenced these faces. */
  url: string;
  /** Family names seen on this page (deduped, alphabetised in the report). */
  families: string[];
}

export interface ConsistencyReport {
  /** All families that appeared on every crawled page. */
  shared: string[];
  /** Per-page breakdown of families found. */
  perPage: PageFaceMap[];
  /** Pages whose family set diverges from the entry page. Empty when the site is consistent. */
  divergent: Array<{
    url: string;
    onlyHere: string[];
    missingHere: string[];
  }>;
}

/**
 * Given the family lists per page, identify shared vs divergent families.
 * The entry page is the baseline; other pages are compared against it.
 *
 * "Shared" is the intersection of all pages' family sets — the typography
 * the entire site agrees on.
 *
 * "Divergent" lists, per page, what it adds vs the entry and what it
 * drops vs the entry. Empty when every page sees the same families.
 */
export function computeConsistency(perPage: PageFaceMap[]): ConsistencyReport {
  if (perPage.length === 0) {
    return { shared: [], perPage: [], divergent: [] };
  }
  const sortedPerPage = perPage.map((p) => ({ url: p.url, families: [...p.families].sort() }));

  const allFamilySets = sortedPerPage.map((p) => new Set(p.families));
  const shared = [...allFamilySets[0]].filter((fam) =>
    allFamilySets.every((s) => s.has(fam)),
  );
  shared.sort();

  const entry = allFamilySets[0];
  const divergent: ConsistencyReport['divergent'] = [];
  for (let i = 1; i < sortedPerPage.length; i++) {
    const here = allFamilySets[i];
    const onlyHere = [...here].filter((f) => !entry.has(f)).sort();
    const missingHere = [...entry].filter((f) => !here.has(f)).sort();
    if (onlyHere.length > 0 || missingHere.length > 0) {
      divergent.push({ url: sortedPerPage[i].url, onlyHere, missingHere });
    }
  }

  return { shared, perPage: sortedPerPage, divergent };
}

/**
 * Build a per-page family map by walking the faces extracted from each
 * page's CSS sources. `sourceToPage` answers "which page did the CSS at
 * index i come from?" so we can attribute faces back to their origin page.
 */
export function buildPageFaceMap(
  pageUrls: string[],
  sourceToPage: number[],
  facesPerSource: FontFace[][],
): PageFaceMap[] {
  const pageFamilies = new Map<string, Set<string>>();
  for (const url of pageUrls) pageFamilies.set(url, new Set());

  for (let i = 0; i < facesPerSource.length; i++) {
    const pageIdx = sourceToPage[i];
    const pageUrl = pageUrls[pageIdx];
    if (!pageUrl) continue;
    const set = pageFamilies.get(pageUrl)!;
    for (const f of facesPerSource[i]) set.add(f.family);
  }

  return pageUrls.map((url) => ({ url, families: [...(pageFamilies.get(url) ?? [])] }));
}

/**
 * Human-readable CONSISTENCY.md content. Only emitted when `--pages > 1`.
 */
export function buildConsistencyReport(report: ConsistencyReport, host: string): string {
  const lines: string[] = [
    `# Cross-page font consistency for ${host}`,
    '',
    `Crawled ${report.perPage.length} page(s). ${report.shared.length} family/families used everywhere; ${report.divergent.length} page(s) diverge from the entry page.`,
    '',
  ];

  lines.push('## Shared across every page');
  lines.push('');
  if (report.shared.length === 0) {
    lines.push('_No families appeared on every page._');
  } else {
    for (const fam of report.shared) lines.push(`- ${fam}`);
  }
  lines.push('');

  lines.push('## Per-page families');
  lines.push('');
  for (const page of report.perPage) {
    lines.push(`### ${page.url}`);
    lines.push('');
    if (page.families.length === 0) {
      lines.push('_No @font-face declarations found on this page._');
    } else {
      for (const fam of page.families) lines.push(`- ${fam}`);
    }
    lines.push('');
  }

  if (report.divergent.length > 0) {
    lines.push('## Divergence from the entry page');
    lines.push('');
    lines.push('_The entry page (first URL crawled) is the baseline. Each row below is a page whose typography differs from the entry._');
    lines.push('');
    for (const d of report.divergent) {
      lines.push(`### ${d.url}`);
      lines.push('');
      if (d.onlyHere.length > 0) {
        lines.push(`- **Only here**: ${d.onlyHere.join(', ')}`);
      }
      if (d.missingHere.length > 0) {
        lines.push(`- **Missing here** (but on entry): ${d.missingHere.join(', ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
