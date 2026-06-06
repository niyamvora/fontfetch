/**
 * Roundness — soften sharp corners into curves.
 *
 * First-cut scope (honest about it): we fillet corners where *both* the
 * incoming and outgoing edges are straight lines, which is where hard corners
 * actually live (E, H, L, T, square counters, stems). At each such corner we
 * trim back along both edges by a radius derived from the slider and the
 * shorter edge, then bridge the gap with a quadratic whose control point is the
 * original corner — a parabolic fillet that reads as a rounded corner for
 * moderate radii. Corners touching a curve, and open contours, pass through
 * unchanged. A future pass can extend this to curve-line and curve-curve joins.
 */
import {
  splitContours,
  joinContours,
  endpoint,
  sub,
  add,
  scale,
  unit,
  len,
  type Point,
  type Contour,
} from '../geometry.js';
import type { GlyphTransform, PathCommand } from '../types.js';

/** Fraction of the shorter adjacent edge consumed at 100% roundness. */
const MAX_TRIM_FRACTION = 0.5;

/** @param pct Corner radius, 0–100. */
export function roundTransform(pct: number): GlyphTransform {
  const k = Math.max(0, Math.min(100, pct)) / 100;
  if (k === 0) return (commands) => commands;
  return (commands) => joinContours(splitContours(commands).map((c) => roundContour(c, k)));
}

interface Node {
  point: Point;
  /** Type of the command that draws *to* this point ('M' for the start). */
  segType: PathCommand['type'];
  /** Original command (used verbatim when its incoming edge is a curve). */
  cmd: PathCommand;
}

function roundContour(contour: Contour, k: number): Contour {
  if (!contour.closed) return contour;

  const nodes: Node[] = [];
  for (const cmd of contour.commands) {
    const p = endpoint(cmd);
    if (p) nodes.push({ point: p, segType: cmd.type, cmd });
  }
  const n = nodes.length;
  if (n < 3) return contour;

  // edgeType(i): the segment from node i to node (i+1). The wrap segment that
  // closes the contour is the implicit straight line a `Z` stands for.
  const edgeType = (i: number): PathCommand['type'] => (i + 1 < n ? nodes[i + 1]!.segType : 'L');
  const filletable = (i: number): boolean =>
    edgeType((i - 1 + n) % n) === 'L' && edgeType(i) === 'L';

  // Per node: where the incoming edge now ends, where the outgoing edge starts,
  // and the corner control point when a fillet is inserted.
  const arrive: Point[] = nodes.map((nd) => nd.point);
  const leave: Point[] = nodes.map((nd) => nd.point);
  const hasFillet: boolean[] = nodes.map(() => false);

  for (let i = 0; i < n; i++) {
    if (!filletable(i)) continue;
    const B = nodes[i]!.point;
    const A = nodes[(i - 1 + n) % n]!.point;
    const C = nodes[(i + 1) % n]!.point;
    const inLen = len(sub(B, A));
    const outLen = len(sub(B, C));
    if (inLen === 0 || outLen === 0) continue;
    const r = Math.min(k * MAX_TRIM_FRACTION * Math.min(inLen, outLen), inLen * 0.5, outLen * 0.5);
    if (r <= 0) continue;
    arrive[i] = add(B, scale(unit(sub(A, B)), r)); // B trimmed toward A
    leave[i] = add(B, scale(unit(sub(C, B)), r)); // B trimmed toward C
    hasFillet[i] = true;
  }

  // Walk the contour emitting trimmed edges + fillet quads.
  const out: PathCommand[] = [{ type: 'M', x: leave[0]!.x, y: leave[0]!.y }];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const segType = edgeType(i);
    if (segType === 'L' || j === 0) {
      out.push({ type: 'L', x: arrive[j]!.x, y: arrive[j]!.y });
    } else {
      // Re-emit the original curve verbatim (its endpoints were never trimmed).
      out.push({ ...nodes[j]!.cmd });
    }
    if (hasFillet[j]) {
      out.push({ type: 'Q', x1: nodes[j]!.point.x, y1: nodes[j]!.point.y, x: leave[j]!.x, y: leave[j]!.y });
    }
  }
  out.push({ type: 'Z' });
  return { commands: out, closed: true };
}
