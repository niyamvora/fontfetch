import { describe, expect, it } from 'vitest';
import { decideMorphPolicy, resolvePosture, checkBlocklist } from '../src/posture.js';
import type { FontLicenseSignal } from '../src/posture.js';

const ofl: FontLicenseSignal = { isOFL: true, hasRFN: false, family: 'Inter' };
const oflRfn: FontLicenseSignal = { isOFL: true, hasRFN: true, family: 'Inter' };
const commercial: FontLicenseSignal = { isOFL: false, hasRFN: false, family: 'Söhne', vendor: 'Klim' };

describe('resolvePosture', () => {
  it('defaults to open', () => {
    expect(resolvePosture({})).toBe('open');
  });
  it('reads ofl-only from the env', () => {
    expect(resolvePosture({ FONTFETCH_MORPH_POSTURE: 'ofl-only' })).toBe('ofl-only');
  });
  it('ignores unknown values', () => {
    expect(resolvePosture({ FONTFETCH_MORPH_POSTURE: 'whatever' })).toBe('open');
  });
});

describe('decideMorphPolicy — open posture', () => {
  it('OFL without RFN: clean path, no watermark, no rename required', () => {
    const p = decideMorphPolicy(ofl);
    expect(p).toMatchObject({
      allowed: true,
      classification: 'ofl',
      requiresRename: false,
      watermark: false,
    });
    expect(p.warnings).toEqual([]);
  });

  it('OFL with RFN: rename is required, still no watermark', () => {
    const p = decideMorphPolicy(oflRfn);
    expect(p).toMatchObject({ allowed: true, classification: 'ofl', requiresRename: true, watermark: false });
    expect(p.warnings.join(' ')).toMatch(/Reserved Font Name/i);
  });

  it('commercial / unknown: allowed but watermarked and warned', () => {
    const p = decideMorphPolicy(commercial);
    expect(p).toMatchObject({ allowed: true, classification: 'restricted', watermark: true });
    expect(p.warnings.join(' ')).toMatch(/EULA/i);
  });
});

describe('decideMorphPolicy — ofl-only posture', () => {
  it('allows OFL', () => {
    expect(decideMorphPolicy(ofl, { posture: 'ofl-only' }).allowed).toBe(true);
  });
  it('refuses commercial / unknown', () => {
    const p = decideMorphPolicy(commercial, { posture: 'ofl-only' });
    expect(p.allowed).toBe(false);
    expect(p.blockedReason).toMatch(/ofl-only/i);
  });
});

describe('morphBlocklist', () => {
  const block = [{ match: 'klim', reason: 'Foundry opted out' }];
  it('matches vendor case-insensitively and blocks', () => {
    expect(checkBlocklist(commercial, block)?.reason).toBe('Foundry opted out');
    const p = decideMorphPolicy(commercial, { blocklist: block });
    expect(p.allowed).toBe(false);
    expect(p.blockedReason).toMatch(/Foundry opted out/);
  });
  it('does not match unrelated fonts', () => {
    expect(checkBlocklist(ofl, block)).toBeUndefined();
  });
  it('is empty by default', () => {
    expect(decideMorphPolicy(commercial).allowed).toBe(true);
  });
});
