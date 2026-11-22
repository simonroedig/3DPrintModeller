import type { Segment } from "../types";

/** sweep of a round shape in degrees (360 = the whole circle) */
export const sweepOf = (s: Segment) => Math.min(360, Math.max(1, s.angle ?? 360));
export const isSegment = (s: Segment) => sweepOf(s) < 360 - 1e-9;

/**
 * 2D bounds of a circle segment: outer radius `r`, from `start` over `sweep` degrees.
 * `ri` > 0: a ring segment; otherwise a slice that reaches the centre.
 */
export function arcBounds(r: number, start = 0, sweep = 360, ri = 0) {
  if (sweep >= 360 - 1e-9) return { minX: -r, minY: -r, maxX: r, maxY: r };
  const a0 = (start * Math.PI) / 180;
  const a1 = ((start + sweep) * Math.PI) / 180;
  const xs: number[] = [];
  const ys: number[] = [];
  const at = (rad: number, a: number) => {
    xs.push(rad * Math.cos(a));
    ys.push(rad * Math.sin(a));
  };
  at(r, a0);
  at(r, a1);
  if (ri > 0) {
    at(ri, a0);
    at(ri, a1);
  } else at(0, 0);
  // the outermost points of the circle (0°, 90°, …) that lie on the arc
  for (let k = Math.ceil(a0 / (Math.PI / 2) - 1e-9); (k * Math.PI) / 2 <= a1 + 1e-9; k++) at(r, (k * Math.PI) / 2);
  const c = (v: number) => Math.round(v * 1e9) / 1e9;
  return { minX: c(Math.min(...xs)), minY: c(Math.min(...ys)), maxX: c(Math.max(...xs)), maxY: c(Math.max(...ys)) };
}
