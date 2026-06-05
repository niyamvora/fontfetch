/**
 * Small, dependency-free geometry helpers shared by the transforms.
 *
 * Everything here works on the {@link PathCommand} list directly so the
 * transforms never have to reach for a heavyweight path library.
 */
import type { PathCommand } from './types.js';

export interface Point {
  x: number;
  y: number;
}

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const len = (a: Point): number => Math.hypot(a.x, a.y);

/** Unit vector of `a`, or {0,0} for a zero-length input. */
export function unit(a: Point): Point {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/**
 * Apply `fn` to every (x, y) coordinate pair present in a command — the
 * endpoint and any control points. Returns a new command; never mutates.
 * This is all the matrix-style transforms (width, slant) ever need.
 */
export function mapCommandPoints(cmd: PathCommand, fn: (p: Point) => Point): PathCommand {
  switch (cmd.type) {
    case 'M':
    case 'L': {
      const p = fn({ x: cmd.x, y: cmd.y });
      return { type: cmd.type, x: p.x, y: p.y };
    }
    case 'Q': {
      const c = fn({ x: cmd.x1, y: cmd.y1 });
      const p = fn({ x: cmd.x, y: cmd.y });
      return { type: 'Q', x1: c.x, y1: c.y, x: p.x, y: p.y };
    }
    case 'C': {
      const c1 = fn({ x: cmd.x1, y: cmd.y1 });
      const c2 = fn({ x: cmd.x2, y: cmd.y2 });
      const p = fn({ x: cmd.x, y: cmd.y });
      return { type: 'C', x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: p.x, y: p.y };
    }
    case 'Z':
      return { type: 'Z' };
  }
}

/** The on-curve endpoint a command draws to, or null for Z. */
export function endpoint(cmd: PathCommand): Point | null {
  return cmd.type === 'Z' ? null : { x: cmd.x, y: cmd.y };
}

/** A single closed (or open) sub-path: the commands between two `M`s. */
export interface Contour {
  commands: PathCommand[];
  /** True when the contour ends with an explicit `Z`. */
  closed: boolean;
}

/**
 * Split a flat command list into contours, one per `M`. The leading `M` is
 * kept as the first command of each contour. A trailing `Z` (if present) is
 * kept too and flips `closed` to true.
 */
export function splitContours(commands: PathCommand[]): Contour[] {
  const contours: Contour[] = [];
  let current: PathCommand[] = [];
  for (const cmd of commands) {
    if (cmd.type === 'M' && current.length > 0) {
      contours.push({ commands: current, closed: lastIsZ(current) });
      current = [];
    }
    current.push(cmd);
  }
  if (current.length > 0) contours.push({ commands: current, closed: lastIsZ(current) });
  return contours;
}

const lastIsZ = (cmds: PathCommand[]): boolean => cmds[cmds.length - 1]?.type === 'Z';

/** Re-join contours back into one flat command list. */
export function joinContours(contours: Contour[]): PathCommand[] {
  return contours.flatMap((c) => c.commands);
}

/**
 * Signed area of a contour's on-curve points (the shoelace formula). The sign
 * encodes winding direction — used by the weight transform to tell an outer
 * outline from a counter (hole) so it can thicken rather than fill.
 */
export function signedArea(commands: PathCommand[]): number {
  const pts = commands.map(endpoint).filter((p): p is Point => p !== null);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}
