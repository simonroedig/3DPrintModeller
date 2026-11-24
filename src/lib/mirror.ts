import * as THREE from "three";
import type { MirrorSpec, Shape } from "../types";

/** a group that only mirrors its one child */
export type MirrorShape = Extract<Shape, { kind: "group" }> & { mirror: MirrorSpec };

export const isMirror = (shape: Shape): shape is MirrorShape => shape.kind === "group" && !!shape.mirror;

/** a box flipped along the mirrored axes */
export function mirrorBox(box: THREE.Box3, m: MirrorSpec): THREE.Box3 {
  for (let a = 0; a < 3; a++) {
    if (!m.axes[a]) continue;
    const c = m.center[a];
    const lo = 2 * c - box.max.getComponent(a);
    const hi = 2 * c - box.min.getComponent(a);
    box.min.setComponent(a, lo);
    box.max.setComponent(a, hi);
  }
  return box;
}
