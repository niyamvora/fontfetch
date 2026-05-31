/**
 * Type definitions for the fontfetch community pairings registry.
 *
 * Generated from `pairings/_schema.json`. Mirrors the JSON Schema 1:1.
 */

export type FontLicense = 'open' | 'commercial' | 'unknown';

export interface PairingFont {
  /** Font family name as it appears in the site CSS. */
  family: string;
  /** How the font is used. Common values: 'headlines', 'body', 'code', 'ui'. */
  role: string;
  /** OpenType weight values observed, e.g. [400, 500, 700]. */
  weights?: number[];
  /** Foundry / designer attribution. */
  foundry?: string;
  /** Licence classification. */
  license: FontLicense;
  /** Free alternatives — typically OFL fonts that approximate the same vibe. */
  free_alternatives?: string[];
}

export interface Pairing {
  /** Human-readable site name. */
  site: string;
  /** Canonical URL where the fonts are observable. */
  url: string;
  /** GitHub handle of the submitter (optional, for credit). */
  submitter?: string;
  /** Screenshot URL or relative path under `pairings/screenshots/`. */
  screenshot?: string;
  /** Fonts observed on the site. */
  fonts: PairingFont[];
  /** Tags for filtering, e.g. ['fintech', 'sans-serif', 'editorial']. */
  tags?: string[];
  /** Free-form notes from the submitter. */
  notes?: string;
  /** How the font was identified, e.g. 'DevTools inspection on 2026-05-27'. */
  source?: string;
}
