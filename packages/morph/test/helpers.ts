/**
 * Test fixtures built in-memory with opentype.js — the repo ships no binary
 * font fixtures, and a synthetic font keeps every assertion deterministic.
 */
import { Font, Glyph, Path } from 'opentype.js';
import type { PathCommand } from '../src/types.js';

/** A closed axis-aligned square contour with bottom-left at (x, y), side `s`. */
export function squareCommands(x: number, y: number, s: number): PathCommand[] {
  return [
    { type: 'M', x, y },
    { type: 'L', x: x + s, y },
    { type: 'L', x: x + s, y: y + s },
    { type: 'L', x, y: y + s },
    { type: 'Z' },
  ];
}

function pathFrom(commands: PathCommand[]): Path {
  const p = new Path();
  p.commands = commands as Path['commands'];
  return p;
}

/**
 * A minimal but valid font: `.notdef` plus one glyph 'A' whose outline is a
 * 600-unit square. unitsPerEm is 1000, so coordinates read as round numbers.
 */
export function makeTestFont(): Uint8Array {
  const notdef = new Glyph({ name: '.notdef', unicode: 0, advanceWidth: 650, path: new Path() });
  const a = new Glyph({
    name: 'A',
    unicode: 65,
    advanceWidth: 700,
    path: pathFrom(squareCommands(100, 100, 600)),
  });
  const font = new Font({
    familyName: 'FontfetchMorphTest',
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: [notdef, a],
  });
  return new Uint8Array(font.toArrayBuffer());
}

/** Max x across every endpoint in a command list (a glyph's right extent). */
export function maxX(commands: PathCommand[]): number {
  return Math.max(...commands.filter((c) => c.type !== 'Z').map((c) => (c as { x: number }).x));
}

/** Bounding box of every endpoint in a command list. */
export function bounds(commands: PathCommand[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const pts = commands.filter((c) => c.type !== 'Z') as Array<{ x: number; y: number }>;
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}
