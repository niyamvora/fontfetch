import { describe, expect, it } from 'vitest';
import { loadFont, saveFont } from '../src/io.js';
import { renameFamily, applyWatermark, watermarkText, readFamily } from '../src/naming.js';
import { makeTestFont } from './helpers.js';

/** Read the first description value from whichever platform carries it. */
function readDescription(font: ReturnType<typeof loadFont>): string | undefined {
  const names = font.names as unknown as {
    windows?: { description?: Record<string, string> };
    macintosh?: { description?: Record<string, string> };
  };
  const field = names.windows?.description ?? names.macintosh?.description;
  return field ? Object.values(field)[0] : undefined;
}

describe('renameFamily', () => {
  it('rewrites the family name and survives serialisation', () => {
    const font = loadFont(makeTestFont());
    expect(readFamily(font)).toBe('FontfetchMorphTest');
    renameFamily(font, 'Sketchbook Prototype');
    const reloaded = loadFont(saveFont(font));
    expect(readFamily(reloaded)).toBe('Sketchbook Prototype');
  });
});

describe('applyWatermark', () => {
  it('embeds the watermark in the name table, surviving round-trip', () => {
    const font = loadFont(makeTestFont());
    const text = watermarkText('Some Commercial Face');
    applyWatermark(font, text);
    const reloaded = loadFont(saveFont(font));
    expect(readDescription(reloaded)).toBe(text);
  });

  it('watermarkText names the original family', () => {
    expect(watermarkText('Söhne')).toMatch(/Söhne/);
    expect(watermarkText('Söhne')).toMatch(/PROTOTYPE/);
  });
});
