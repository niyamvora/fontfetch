import type { FontFace } from '../types.js';
import { bucketForUrl } from '../license/provenance.js';

/**
 * v1.4: GDPR report. Scans a pull's faces for third-party font requests
 * (Google Fonts CDN, Adobe Fonts, Hoefler, Monotype, etc.) and lists them
 * with a one-line self-hosting remediation per family.
 *
 * Triggered by the German court ruling
 * (LG München I 20 O 1393/21 — 2022-01-20) that found Google Fonts CDN
 * embeds a GDPR-violating data transfer. The same logic applies to every
 * cross-origin font request that exposes the visitor's IP to a third party.
 */
export interface GdprFinding {
  family: string;
  /** Bucket the URL was classified into (google / adobe-typekit / commercial / open-cdn). */
  bucket: 'google' | 'adobe-typekit' | 'commercial' | 'open-cdn' | 'self-hosted';
  /** Original cross-origin URL. */
  url: string;
  /** Privacy risk severity. */
  severity: 'high' | 'medium' | 'low';
  /** Human-readable remediation hint. */
  remediation: string;
}

export interface GdprReport {
  schemaVersion: '1.0';
  generatedAt: string;
  host: string;
  sourceUrl: string;
  findings: GdprFinding[];
  summary: {
    thirdParty: number;
    selfHosted: number;
    highSeverity: number;
  };
}

const REMEDIATION_BY_BUCKET: Record<GdprFinding['bucket'], { severity: GdprFinding['severity']; hint: string }> = {
  google: {
    severity: 'high',
    hint: 'Self-host the Google Fonts CDN binaries. Use fontfetch to extract them, then serve from your own origin. Avoid bunny.net Fonts only if your DPA also covers Bunny.',
  },
  'adobe-typekit': {
    severity: 'high',
    hint: 'Adobe Fonts requires an active licence. You cannot self-host the binaries under the standard agreement — you must remove the family OR negotiate a bespoke licence that allows self-hosting.',
  },
  commercial: {
    severity: 'high',
    hint: 'Commercial foundry CDN. Check the licence for self-host rights, then download the binaries directly from the foundry portal (not via this CDN).',
  },
  'open-cdn': {
    severity: 'medium',
    hint: 'Open CDN (Fontsource, rsms.me, jsdelivr). Self-host the binaries OR use Bunny Fonts as a GDPR-compliant proxy. Fontsource also publishes per-family npm packages.',
  },
  'self-hosted': {
    severity: 'low',
    hint: 'Already on the same origin. No third-party request; nothing to remediate.',
  },
};

export function buildGdprReport(
  host: string,
  sourceUrl: string,
  faces: FontFace[],
): GdprReport {
  const findings: GdprFinding[] = [];
  const seen = new Set<string>(); // dedupe by family + bucket
  const pageHost = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return host;
    }
  })();

  for (const f of faces) {
    for (const s of f.sources) {
      const bucket = bucketForUrl(s.url, pageHost);
      const key = `${f.family}|${bucket}|${s.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = REMEDIATION_BY_BUCKET[bucket];
      findings.push({
        family: f.family,
        bucket,
        url: s.url,
        severity: meta.severity,
        remediation: meta.hint,
      });
    }
  }

  const thirdParty = findings.filter((f) => f.bucket !== 'self-hosted').length;
  const selfHosted = findings.filter((f) => f.bucket === 'self-hosted').length;
  const highSeverity = findings.filter((f) => f.severity === 'high').length;

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    host,
    sourceUrl,
    findings,
    summary: { thirdParty, selfHosted, highSeverity },
  };
}

/**
 * Render GDPR.md content from the structured report. Designed for legal /
 * privacy reviewers to read directly — leads with the action items.
 */
export function formatGdprMarkdown(report: GdprReport): string {
  const lines: string[] = [
    `# GDPR review for ${report.host}`,
    '',
    '> Heuristic-only. Not legal advice. Built on the post-LG München I 20 O 1393/21 understanding that cross-origin font loading from a third-party CDN exposes the visitor\'s IP address to a controller the site operator has no DPA with.',
    '',
    '## Summary',
    '',
    `- ${report.summary.thirdParty} third-party font request(s)`,
    `- ${report.summary.selfHosted} self-hosted request(s)`,
    `- ${report.summary.highSeverity} high-severity finding(s)`,
    '',
  ];

  if (report.summary.thirdParty === 0) {
    lines.push('✓ No third-party font requests detected. Fonts are served from the same origin.');
    return lines.join('\n');
  }

  lines.push('## Findings');
  lines.push('');
  const byBucket = new Map<string, GdprFinding[]>();
  for (const f of report.findings) {
    if (f.bucket === 'self-hosted') continue;
    const list = byBucket.get(f.bucket) ?? [];
    list.push(f);
    byBucket.set(f.bucket, list);
  }

  const severityIcon: Record<GdprFinding['severity'], string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  for (const [bucket, list] of byBucket) {
    lines.push(`### ${bucketLabel(bucket as GdprFinding['bucket'])}`);
    lines.push('');
    const families = new Map<string, GdprFinding[]>();
    for (const f of list) {
      const arr = families.get(f.family) ?? [];
      arr.push(f);
      families.set(f.family, arr);
    }
    for (const [family, occurrences] of families) {
      const sev = occurrences[0].severity;
      lines.push(`- ${severityIcon[sev]} **${family}** — ${occurrences[0].remediation}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function bucketLabel(b: GdprFinding['bucket']): string {
  switch (b) {
    case 'google':
      return 'Google Fonts CDN (high risk — German court precedent)';
    case 'adobe-typekit':
      return 'Adobe Fonts / Typekit';
    case 'commercial':
      return 'Commercial foundry CDN';
    case 'open-cdn':
      return 'Open-licence CDN';
    case 'self-hosted':
      return 'Self-hosted';
  }
}
