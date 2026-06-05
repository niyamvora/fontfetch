/**
 * The licensing posture — Step 5 of the v1.5 build, and the gate the whole
 * feature hangs off.
 *
 * Standing decision: ship the **"allow all, warn per font"** posture. Anyone can
 * morph any font, but a commercial/unknown input is warned about loudly and its
 * output is watermarked and named as a mockup. The stricter **ofl-only** posture
 * exists in code from day one behind an env switch, so the day a foundry
 * complains the flip is config, not a refactor.
 */

/** `open` allows any input; `ofl-only` refuses anything not self-declared OFL. */
export type MorphPosture = 'open' | 'ofl-only';

/** License signal for the input font, sourced from its binary (name table). */
export interface FontLicenseSignal {
  /** The binary self-declares the SIL Open Font License (name id 13/14). */
  isOFL: boolean;
  /** The OFL Reserved Font Name clause is present — redistribution must rename. */
  hasRFN: boolean;
  /** Vendor / foundry string, used for blocklist matching. Best-effort. */
  vendor?: string;
  /** Family name, used to derive the default prototype rename. */
  family?: string;
}

/**
 * A per-foundry hard block, matched case-insensitively against the input's
 * vendor/family. Initially empty — the same shape as the CDN signature lists in
 * core, so adding a block is a one-line change if a foundry ever demands it.
 */
export interface FoundrySignature {
  /** Substring matched against vendor/family (case-insensitive). */
  match: string;
  /** Human-readable reason surfaced to the user when blocked. */
  reason: string;
}

/** Hard blocks. Empty by default; populated only on explicit foundry request. */
export const morphBlocklist: FoundrySignature[] = [];

/** How the input is treated downstream. */
export type MorphClassification = 'ofl' | 'restricted';

export interface MorphPolicy {
  /** False → refuse to morph (ofl-only posture or a blocklist hit). */
  allowed: boolean;
  /** Why it was refused, when `allowed` is false. */
  blockedReason?: string;
  /** `ofl` gets the clean path; `restricted` is commercial-or-unknown. */
  classification: MorphClassification;
  /** OFL + Reserved Font Name → a rename is mandatory before redistribution. */
  requiresRename: boolean;
  /** Restricted inputs get an in-binary watermark + mockup naming. */
  watermark: boolean;
  /** Advisories to print (EULA warning, RFN rename note). */
  warnings: string[];
}

/** Resolve the active posture from the environment (defaults to `open`). */
export function resolvePosture(env: Record<string, string | undefined> = process.env): MorphPosture {
  return env.FONTFETCH_MORPH_POSTURE === 'ofl-only' ? 'ofl-only' : 'open';
}

/** Check the input against the (normally empty) foundry blocklist. */
export function checkBlocklist(
  signal: FontLicenseSignal,
  blocklist: FoundrySignature[] = morphBlocklist,
): FoundrySignature | undefined {
  const hay = `${signal.vendor ?? ''} ${signal.family ?? ''}`.toLowerCase();
  return blocklist.find((sig) => hay.includes(sig.match.toLowerCase()));
}

/**
 * Decide how (and whether) to morph an input given its license signal and the
 * active posture. Pure — does no I/O and never throws.
 */
export function decideMorphPolicy(
  signal: FontLicenseSignal,
  opts: { posture?: MorphPosture; blocklist?: FoundrySignature[] } = {},
): MorphPolicy {
  const posture = opts.posture ?? 'open';
  const classification: MorphClassification = signal.isOFL ? 'ofl' : 'restricted';
  const warnings: string[] = [];

  const blocked = checkBlocklist(signal, opts.blocklist);
  if (blocked) {
    return {
      allowed: false,
      blockedReason: `Blocked by morphBlocklist: ${blocked.reason}`,
      classification,
      requiresRename: false,
      watermark: false,
      warnings,
    };
  }

  if (posture === 'ofl-only' && classification === 'restricted') {
    return {
      allowed: false,
      blockedReason:
        'FONTFETCH_MORPH_POSTURE=ofl-only: this font is not self-declared OFL, so morphing is refused.',
      classification,
      requiresRename: false,
      watermark: false,
      warnings,
    };
  }

  const requiresRename = classification === 'ofl' && signal.hasRFN;
  const watermark = classification === 'restricted';

  if (watermark) {
    warnings.push(
      "This font's EULA almost certainly forbids modification. Use only for internal prototyping; do not distribute the result.",
    );
  }
  if (requiresRename) {
    warnings.push(
      'OFL Reserved Font Name: the morphed font must be renamed before any redistribution. The original family name cannot appear in the derivative name.',
    );
  }

  return { allowed: true, classification, requiresRename, watermark, warnings };
}
