/**
 * Font load / save plumbing — Step 2 of the v1.5 morph build.
 *
 * opentype.js is the only mature library that both *reads* and *writes* font
 * binaries (fontkit, used elsewhere in fontfetch, is read-only). We parse to an
 * opentype `Font`, let the transforms rewrite each glyph's outline, then
 * re-serialise.
 *
 * Input: any TrueType/OpenType/WOFF binary opentype.js can parse. WOFF2 must be
 * decompressed to one of those first — that wiring lands with the CLI in a later
 * step. Output is always a TrueType-flavoured OpenType binary (opentype.js's
 * writer emits `glyf`), which is universally loadable.
 */
// opentype.js v2 ships as CommonJS. A named ESM import (`import { parse }`)
// transpiles fine but throws under real Node ESM ("Named export not found"),
// so we take the default export and destructure — the interop-safe form.
import opentype from 'opentype.js';
import type { PathCommand } from './types.js';

const { parse, Path } = opentype;
type Font = opentype.Font;
type Glyph = opentype.Glyph;

/** Parse a font binary into an opentype.js `Font`. Throws on unparseable input. */
export function loadFont(data: Uint8Array | ArrayBuffer): Font {
  const buffer = data instanceof Uint8Array ? toArrayBuffer(data) : data;
  return parse(buffer);
}

/** Serialise an opentype.js `Font` back to a binary. */
export function saveFont(font: Font): Uint8Array {
  return new Uint8Array(font.toArrayBuffer());
}

/** Number of glyphs in the font. */
export function glyphCount(font: Font): number {
  return font.glyphs.length;
}

/** Read a glyph's outline as a normalised {@link PathCommand} list. */
export function readGlyphCommands(glyph: Glyph): PathCommand[] {
  // opentype's command objects are structurally compatible, but we copy into
  // our own discriminated union so downstream code is fully typed and we never
  // alias opentype's internal arrays.
  return (glyph.path.commands as PathCommand[]).map(cloneCommand);
}

/** Replace a glyph's outline with a new command list. */
export function writeGlyphCommands(glyph: Glyph, commands: PathCommand[]): void {
  const path = new Path();
  path.commands = commands.map(cloneCommand) as opentype.Path['commands'];
  glyph.path = path;
}

function cloneCommand(cmd: PathCommand): PathCommand {
  return { ...cmd };
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Slice so we hand opentype a tight ArrayBuffer even if `u8` is a view into
  // a larger pool (Node Buffers frequently are).
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? (u8.buffer as ArrayBuffer)
    : (u8.slice().buffer as ArrayBuffer);
}
