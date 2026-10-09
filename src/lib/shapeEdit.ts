import * as THREE from "three";
import type { Body, Shape, Vec3 } from "../types";
import { bodyMatrix, localBox, polyBounds } from "./geom";
import { snapTo } from "./units";

const MIN = 0.1;

/** Scale a shape so its local extent along `axis` becomes `size`. */
export function resizeLocal(shape: Shape, axis: number, size: number): Shape | null {
  const s = Math.max(size, MIN);
  switch (shape.kind) {
    case "box":
    case "wedge": {
      const k = (["w", "d", "h"] as const)[axis];
      return { ...shape, [k]: s };
    }
    case "cylinder":
    case "tube":
      if (axis === 2) return { ...shape, h: s };
      if (shape.kind === "tube") return { ...shape, d: s, t: Math.min(shape.t, s / 2 - 0.01) };
      return { ...shape, d: s };
    case "cone": {
      if (axis === 2) return { ...shape, h: s };
      const f = s / Math.max(shape.d1, shape.d2, MIN);
      return { ...shape, d1: shape.d1 * f, d2: shape.d2 * f };
    }
    case "sphere":
      return { ...shape, d: s };
    case "prism": {
      if (axis === 2) return { ...shape, h: s };
      const pb = polyBounds(shape.points);
      const cur = axis === 0 ? pb.maxX - pb.minX : pb.maxY - pb.minY;
      const f = s / Math.max(cur, MIN);
      return {
        ...shape,
        points: shape.points.map(([x, y]) => (axis === 0 ? [pb.minX + (x - pb.minX) * f, y] : [x, pb.minY + (y - pb.minY) * f])),
      };
    }
    case "imported": {
      const cur = (shape.max[axis] - shape.min[axis]) * shape.scale;
      return cur > 0 ? { ...shape, scale: (shape.scale * s) / cur } : null;
    }
    case "group":
      return null;
  }
}

/** Which local axis of the body is aligned with the given world axis (only for 90° rotations). */
export function alignedLocalAxis(body: Body, worldAxis: number): number | null {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...body.quaternion));
  const e = m.elements; // column-major: column l = world dir of local axis l
  for (let l = 0; l < 3; l++) {
    if (Math.abs(e[l * 4 + worldAxis]) > 0.9999) return l;
  }
  return null;
}

/** Resize a body along a world axis, keeping the world min corner in place. */
export function resizeWorld(body: Body, worldAxis: number, size: number): Partial<Body> | null {
  const l = alignedLocalAxis(body, worldAxis);
  if (l === null) return null;
  const shape = resizeLocal(body.shape, l, size);
  if (!shape) return null;
  const m = bodyMatrix(body);
  const before = localBox(body.shape).applyMatrix4(m);
  const after = localBox(shape).applyMatrix4(m);
  const shift = before.min.clone().sub(after.min);
  return { shape, position: [body.position[0] + shift.x, body.position[1] + shift.y, body.position[2] + shift.z] };
}

export interface HandleSpec {
  id: string;
  /** local position */
  pos: Vec3;
  /** local direction */
  dir: Vec3;
  label: string;
  /** returns the new shape plus a local shift of the origin */
  apply: (t: number, snap: number) => { shape: Shape; shift: Vec3; value: number };
}

/** handle on the bottom face that grows a height parameter downwards */
function bottomHandle(shape: Shape & { h: number }, pos: Vec3, sn: (v: number, snap: number) => number): HandleSpec {
  return {
    id: "h-",
    pos,
    dir: [0, 0, -1],
    label: "Höhe (unten)",
    apply: (t, snap) => {
      const v = sn(shape.h + t, snap);
      return { shape: { ...shape, h: v } as Shape, shift: [0, 0, shape.h - v], value: v };
    },
  };
}

export function handleSpecs(shape: Shape): HandleSpec[] {
  const sn = (v: number, snap: number) => Math.max(snapTo(v, snap), snap || MIN);
  switch (shape.kind) {
    case "box":
    case "wedge": {
      const { w, d, h } = shape;
      const wedge = shape.kind === "wedge";
      const side = (axis: 0 | 1 | 2, neg: boolean): HandleSpec => {
        const k = (["w", "d", "h"] as const)[axis];
        const cur = shape[k];
        const pos: Vec3 = [w / 2, d / 2, h / 2];
        if (wedge) {
          pos[1] = (2 * d) / 3;
          pos[2] = h / 3;
        }
        pos[axis] = neg ? 0 : cur;
        if (wedge && axis === 1) pos[2] = neg ? 0 : h / 2;
        if (wedge && axis === 2) pos[1] = neg ? d / 2 : d;
        const dir: Vec3 = [0, 0, 0];
        dir[axis] = neg ? -1 : 1;
        return {
          id: `${neg ? "-" : "+"}${axis}`,
          pos,
          dir,
          label: ["Breite", "Tiefe", "Höhe"][axis],
          apply: (t, snap) => {
            const v = sn(cur + t, snap);
            const shift: Vec3 = [0, 0, 0];
            if (neg) shift[axis] = cur - v;
            return { shape: { ...shape, [k]: v }, shift, value: v };
          },
        };
      };
      return [side(0, false), side(0, true), side(1, false), side(1, true), side(2, false), side(2, true)];
    }
    case "cylinder":
    case "tube":
    case "sphere": {
      const r = shape.d / 2;
      const h = shape.kind === "sphere" ? shape.d : shape.h;
      const list: HandleSpec[] = [
        {
          id: "r",
          pos: [r, 0, h / 2],
          dir: [1, 0, 0],
          label: "Durchmesser",
          apply: (t, snap) => {
            const v = sn(shape.d + 2 * t, snap);
            const next = shape.kind === "tube" ? { ...shape, d: v, t: Math.min(shape.t, v / 2 - 0.01) } : { ...shape, d: v };
            return { shape: next, shift: [0, 0, 0], value: v };
          },
        },
      ];
      if (shape.kind !== "sphere") {
        list.push(bottomHandle(shape, [0, 0, 0], sn));
        list.push({
          id: "h",
          pos: [0, 0, shape.h],
          dir: [0, 0, 1],
          label: "Höhe",
          apply: (t, snap) => {
            const v = sn(shape.h + t, snap);
            return { shape: { ...shape, h: v }, shift: [0, 0, 0], value: v };
          },
        });
      }
      return list;
    }
    case "cone":
      return [
        {
          id: "d1",
          pos: [shape.d1 / 2, 0, 0],
          dir: [1, 0, 0],
          label: "Ø unten",
          apply: (t, snap) => {
            const v = Math.max(snapTo(shape.d1 + 2 * t, snap), 0);
            return { shape: { ...shape, d1: v }, shift: [0, 0, 0], value: v };
          },
        },
        {
          id: "d2",
          pos: [shape.d2 / 2, 0, shape.h],
          dir: [1, 0, 0],
          label: "Ø oben",
          apply: (t, snap) => {
            const v = Math.max(snapTo(shape.d2 + 2 * t, snap), 0);
            return { shape: { ...shape, d2: v }, shift: [0, 0, 0], value: v };
          },
        },
        {
          id: "h",
          pos: [0, 0, shape.h],
          dir: [0, 0, 1],
          label: "Höhe",
          apply: (t, snap) => {
            const v = sn(shape.h + t, snap);
            return { shape: { ...shape, h: v }, shift: [0, 0, 0], value: v };
          },
        },
        bottomHandle(shape, [0, 0, 0], sn),
      ];
    case "prism": {
      const pb = polyBounds(shape.points);
      return [
        {
          id: "h",
          pos: [(pb.minX + pb.maxX) / 2, (pb.minY + pb.maxY) / 2, shape.h],
          dir: [0, 0, 1],
          label: "Höhe",
          apply: (t, snap) => {
            const v = sn(shape.h + t, snap);
            return { shape: { ...shape, h: v }, shift: [0, 0, 0], value: v };
          },
        },
        bottomHandle(shape, [(pb.minX + pb.maxX) / 2, (pb.minY + pb.maxY) / 2, 0], sn),
      ];
    }
    case "imported":
    case "group":
      return [];
  }
}
