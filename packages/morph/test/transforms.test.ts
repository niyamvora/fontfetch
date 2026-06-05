import { describe, expect, it } from 'vitest';
import { widthTransform } from '../src/transforms/width.js';
import { slantTransform } from '../src/transforms/slant.js';
import { roundTransform } from '../src/transforms/round.js';
import { weightTransform } from '../src/transforms/weight.js';
import type { PathCommand } from '../src/types.js';
import { squareCommands, bounds } from './helpers.js';

const UPEM = 1000;
const square = squareCommands(100, 100, 600);

const xs = (cmds: PathCommand[]) =>
  cmds.filter((c) => c.type !== 'Z').map((c) => (c as { x: number }).x);

describe('width', () => {
  it('scales every x by the factor and leaves y untouched', () => {
    const out = widthTransform(1.2)(square, UPEM);
    expect(xs(out)).toEqual([120, 840, 840, 120]);
    const ys = out.filter((c) => c.type !== 'Z').map((c) => (c as { y: number }).y);
    expect(ys).toEqual([100, 100, 700, 700]);
  });

  it('factor of 1 is a no-op shape', () => {
    expect(widthTransform(1)(square, UPEM)).toEqual(square);
  });
});

describe('slant', () => {
  it('shears x by tan(angle)*y, holding the baseline', () => {
    const out = slantTransform(10)(square, UPEM);
    const t = Math.tan((10 * Math.PI) / 180);
    // Bottom-left (100,100) → x + t*100; top-left (100,700) → x + t*700.
    const bl = out[0] as { x: number; y: number };
    const tl = out[3] as { x: number; y: number };
    expect(bl.x).toBeCloseTo(100 + t * 100, 4);
    expect(tl.x).toBeCloseTo(100 + t * 700, 4);
    // Higher points lean further right than lower ones.
    expect(tl.x).toBeGreaterThan(bl.x);
  });
});

describe('round', () => {
  it('replaces each straight corner of a square with a quadratic fillet', () => {
    const out = roundTransform(50)(square, UPEM);
    const quads = out.filter((c) => c.type === 'Q');
    expect(quads).toHaveLength(4); // one per corner
    // Fillet radius at 50% = 0.5 * 0.5 * side(600) = 150. The quad control
    // points sit on the original corners.
    const controls = quads.map((q) => ({ x: (q as { x1: number }).x1, y: (q as { y1: number }).y1 }));
    expect(controls).toContainEqual({ x: 100, y: 100 });
    expect(controls).toContainEqual({ x: 700, y: 700 });
    // Rounding never pushes the outline past its original bounding box.
    const b = bounds(out);
    expect(b.minX).toBeGreaterThanOrEqual(100);
    expect(b.maxX).toBeLessThanOrEqual(700);
  });

  it('0% is a no-op', () => {
    expect(roundTransform(0)(square, UPEM)).toEqual(square);
  });

  it('leaves contours with curves untouched', () => {
    const withCurve: PathCommand[] = [
      { type: 'M', x: 0, y: 0 },
      { type: 'Q', x1: 50, y1: 100, x: 100, y: 0 },
      { type: 'L', x: 0, y: 0 },
      { type: 'Z' },
    ];
    // Only one straight-straight corner exists here (none — the L's neighbours
    // are a curve and the closing edge), so nothing is filleted.
    const out = roundTransform(80)(withCurve, UPEM);
    expect(out.filter((c) => c.type === 'Q')).toHaveLength(1); // the original Q only
  });
});

describe('weight (experimental)', () => {
  it('expands an outer (CCW) contour outward', () => {
    const out = weightTransform(10)(square, UPEM);
    const b = bounds(out);
    // d = (10/100) * 0.15 * 1000 = 15 units of outward offset.
    expect(b.minX).toBeLessThan(100);
    expect(b.maxX).toBeGreaterThan(700);
    expect(b.minY).toBeLessThan(100);
    expect(b.maxY).toBeGreaterThan(700);
  });

  it('contracts on negative weight', () => {
    const out = weightTransform(-10)(square, UPEM);
    const b = bounds(out);
    expect(b.maxX).toBeLessThan(700);
    expect(b.minX).toBeGreaterThan(100);
  });

  it('0 is a no-op', () => {
    expect(weightTransform(0)(square, UPEM)).toEqual(square);
  });
});
