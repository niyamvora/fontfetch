/**
 * Name-table editing — the binary half of Step 5's guardrails.
 *
 * `renameFamily` enforces the OFL Reserved Font Name rule and provides the
 * default "<original> Prototype" identity. `applyWatermark` stamps an
 * in-binary, copy/paste-surviving note into commercial-classified outputs.
 *
 * opentype.js v2 stores names split by platform (`windows`, `macintosh`) and
 * keyed by language. The published @types describe an older flat shape, so we
 * access the real structure through a narrow local view rather than `any`.
 */
import type opentype from 'opentype.js';

type Font = opentype.Font;
type LocalizedField = Record<string, string>;
type PlatformNames = Record<string, LocalizedField>;
interface SplitNames {
  windows?: PlatformNames;
  macintosh?: PlatformNames;
  unicode?: PlatformNames;
}

const PLATFORMS = ['windows', 'macintosh', 'unicode'] as const;

function splitNames(font: Font): SplitNames {
  return font.names as unknown as SplitNames;
}

/** Language keys to use when creating a field that doesn't exist yet. */
function refLangs(platform: PlatformNames): string[] {
  const langs = Object.keys(platform.fontFamily ?? platform.fullName ?? { en: '' });
  return langs.length > 0 ? langs : ['en'];
}

/** Set a name field to one value across every platform and language present. */
function setField(font: Font, field: string, value: string): void {
  const names = splitNames(font);
  for (const platform of PLATFORMS) {
    const p = names[platform];
    if (!p) continue;
    if (p[field]) {
      for (const lang of Object.keys(p[field]!)) p[field]![lang] = value;
    } else {
      const next: LocalizedField = {};
      for (const lang of refLangs(p)) next[lang] = value;
      p[field] = next;
    }
  }
}

/** Read the first available value of a name field. */
function getField(font: Font, field: string): string | undefined {
  const names = splitNames(font);
  for (const platform of PLATFORMS) {
    const f = names[platform]?.[field];
    if (f) {
      const first = Object.values(f)[0];
      if (first) return first;
    }
  }
  return undefined;
}

/** The font's family name, if any. */
export function readFamily(font: Font): string | undefined {
  return getField(font, 'fontFamily');
}

/** The font's vendor/manufacturer string, if any. */
export function readVendor(font: Font): string | undefined {
  return getField(font, 'manufacturer') ?? getField(font, 'designer');
}

/** A PostScript-safe identifier (no spaces or reserved characters). */
function postscriptSafe(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 63) || 'Prototype';
}

/**
 * Rename the font's family (and the derived full / PostScript / unique names).
 * Used for the default "<original> Prototype" identity and to satisfy the OFL
 * Reserved Font Name clause.
 */
export function renameFamily(font: Font, newName: string): void {
  setField(font, 'fontFamily', newName);
  setField(font, 'fullName', newName);
  setField(font, 'preferredFamily', newName);
  setField(font, 'postScriptName', postscriptSafe(newName));
  setField(font, 'uniqueID', `${newName} — fontfetch morph`);
}

/** The note embedded in commercial-classified outputs. */
export function watermarkText(originalFamily: string): string {
  return `PROTOTYPE — derived from ${originalFamily} by fontfetch morph. Not for production use.`;
}

/**
 * Stamp a watermark into the binary's name table. Written to `description` and
 * appended to `copyright` so it survives copy/paste and shows up in any font
 * inspector.
 */
export function applyWatermark(font: Font, text: string): void {
  setField(font, 'description', text);
  const existing = getField(font, 'copyright');
  setField(font, 'copyright', existing ? `${existing} — ${text}` : text);
}
