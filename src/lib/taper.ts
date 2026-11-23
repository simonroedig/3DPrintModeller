import type { Taper } from "../types";

/** true if the back end (y = d) of a box or wedge has another width than the front */
export const isTapered = (s: { w: number } & Taper) => s.w2 !== undefined && Math.abs(s.w2 - s.w) > 1e-9;

/** width at the back end */
export const backWidth = (s: { w: number } & Taper) => s.w2 ?? s.w;

/**
 * X ranges of the front edge (y = 0) and the back edge (y = d) of a box or wedge whose back end can
 * have another width. `W` is the overall width; the narrower end sits in the middle or against one side.
 */
export function taperXs(s: { w: number } & Taper) {
  const w2 = backWidth(s);
  const W = Math.max(s.w, w2);
  const at = (width: number): [number, number] =>
    s.align === "left" ? [0, width] : s.align === "right" ? [W - width, W] : [(W - width) / 2, (W + width) / 2];
  return { W, front: at(s.w), back: at(w2) };
}

/** a wedge whose right side rises to another height than its left side */
export const isSkewed = (s: { h: number; hr?: number }) => s.hr !== undefined && Math.abs(s.hr - s.h) > 1e-9;
