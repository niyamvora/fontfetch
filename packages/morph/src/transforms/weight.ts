/**
 * Weight — make strokes thicker or thinner.
 *
 * EXPERIMENTAL on static fonts (the roadmap clamps it to ±15% and says so).
 * We approximate stroke change by offsetting each outline vertex along its
 * outward normal, using the contour winding (shoelace sign) to tell an outer
 * outline from a counter so the ink thickens instead of just translating. This
 * is a believable prototype, not a true stroke-expansion — it can self-collide
 * at extreme values, which is why the value is clamped upstream. A variable
 * font's `wght` axis is the lossless path and is preferred when available
 * (that wiring lands with the CLI step).
 */
import { splitContours, joinContours, endpoint, sub, add, scale, unit, signedArea, type Point } from '../geometry.js';
import type { GlyphTransform, PathCommand } from '../types.js';

/** Outward offset at ±100% expressed as a fraction of the em. */
const OFFSET_FACTOR = 0.15;

/** Right-hand normal of a direction vector. */
const rightNormal = (d: Point): Point => ({ x: d.y, y: -d.x });

/** @param pct Stroke delta, e.g. +10 for ~10% heavier. */
export function weightTransform(pct: number): GlyphTransform {
  if (pct === 0) return (commands) => commands;
  return (commands, unitsPerEm) => {
    const d = (pct / 100) * OFFSET_FACTOR * unitsPerEm;
    return joinContours(
      splitContours(commands).map((c) => {
        const anchors: { idx: number; point: Point }[] = [];
        c.commands.forEach((cmd, idx) => {
          const p = endpoint(cmd);
          if (p) anchors.push({ idx, point: p });
        });
        const n = anchors.length;
        if (n < 3) return c;

        const winding = Math.sign(signedArea(c.commands)) || 1;
        // Displacement per anchor: average of the two adjacent edge normals,
        // flipped by winding so outer outlines expand and counters contract.
        const delta = new Map<number, Point>();
        for (let i = 0; i < n; i++) {
          const prev = anchors[(i - 1 + n) % n]!.point;
          const cur = anchors[i]!.point;
          const next = anchors[(i + 1) % n]!.point;
          const nIn = rightNormal(unit(sub(cur, prev)));
          const nOut = rightNormal(unit(sub(next, cur)));
          const dir = unit(add(nIn, nOut));
          delta.set(anchors[i]!.idx, scale(dir, d * winding));
        }

        const moved = c.commands.map((cmd, idx) => {
          const mv = delta.get(idx);
          return mv ? translateCommand(cmd, mv) : cmd;
        });
        return { commands: moved, closed: c.closed };
      }),
    );
  };
}

/** Shift a command's endpoint and any control points by `mv`. */
function translateCommand(cmd: PathCommand, mv: Point): PathCommand {
  switch (cmd.type) {
    case 'M':
    case 'L':
      return { type: cmd.type, x: cmd.x + mv.x, y: cmd.y + mv.y };
    case 'Q':
      return { type: 'Q', x1: cmd.x1 + mv.x, y1: cmd.y1 + mv.y, x: cmd.x + mv.x, y: cmd.y + mv.y };
    case 'C':
      return {
        type: 'C',
        x1: cmd.x1 + mv.x,
        y1: cmd.y1 + mv.y,
        x2: cmd.x2 + mv.x,
        y2: cmd.y2 + mv.y,
        x: cmd.x + mv.x,
        y: cmd.y + mv.y,
      };
    case 'Z':
      return { type: 'Z' };
  }
}
