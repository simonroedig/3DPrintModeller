import * as THREE from "three";
import type { Vec3 } from "../types";
import type { Guide } from "../store/store";
import { snapTo } from "./units";

export interface SnapResult {
  delta: Vec3;
  guides: Guide[];
  snapped: [boolean, boolean, boolean];
}

const comp = (v: THREE.Vector3, a: number) => v.getComponent(a);

/**
 * Snaps a translation of `moving` (its box at drag start) by `raw`:
 * faces of other boxes (touching / flush / centred) win over the grid.
 */
export function snapMove(
  moving: THREE.Box3,
  raw: Vec3,
  axes: number[],
  others: THREE.Box3[],
  grid: number,
  threshold: number,
): SnapResult {
  const delta: Vec3 = [...raw];
  const guides: Guide[] = [];
  const snapped: [boolean, boolean, boolean] = [false, false, false];

  for (const a of axes) {
    const mMin = comp(moving.min, a) + raw[a];
    const mMax = comp(moving.max, a) + raw[a];
    const mC = (mMin + mMax) / 2;
    let best: { diff: number; target: number; other: THREE.Box3 | null; touch: boolean } | null = null;
    const consider = (from: number, target: number, other: THREE.Box3 | null, touch: boolean) => {
      const diff = target - from;
      if (Math.abs(diff) > threshold) return;
      const score = Math.abs(diff) - (touch ? threshold * 0.25 : 0);
      if (!best || score < Math.abs(best.diff) - (best.touch ? threshold * 0.25 : 0)) best = { diff, target, other, touch };
    };
    for (const o of others) {
      const oMin = comp(o.min, a);
      const oMax = comp(o.max, a);
      consider(mMin, oMax, o, true);
      consider(mMax, oMin, o, true);
      consider(mMin, oMin, o, false);
      consider(mMax, oMax, o, false);
      consider(mC, (oMin + oMax) / 2, o, false);
    }
    if (a === 2) consider(mMin, 0, null, true);
    const b = best as { diff: number; target: number; other: THREE.Box3 | null; touch: boolean } | null;
    if (b) {
      delta[a] = raw[a] + b.diff;
      snapped[a] = true;
      if (b.other) guides.push(makeGuide(moving, delta, b.other, a, b.target));
    } else {
      delta[a] = snapTo(raw[a], grid);
    }
  }
  return { delta, guides, snapped };
}

function makeGuide(moving: THREE.Box3, delta: Vec3, other: THREE.Box3, axis: number, value: number): Guide {
  const m = moving.clone().translate(new THREE.Vector3(...delta));
  // line runs along the "longest shared" other axis
  const along = axis === 0 ? 1 : 0;
  const level = axis === 2 ? 1 : 2;
  const lo = Math.min(comp(m.min, along), comp(other.min, along)) - 4;
  const hi = Math.max(comp(m.max, along), comp(other.max, along)) + 4;
  const lev = Math.min(comp(m.min, level), comp(other.min, level));
  const a: Vec3 = [0, 0, 0];
  const b: Vec3 = [0, 0, 0];
  a[axis] = value;
  b[axis] = value;
  a[along] = lo;
  b[along] = hi;
  a[level] = lev;
  b[level] = lev;
  return { a, b };
}
