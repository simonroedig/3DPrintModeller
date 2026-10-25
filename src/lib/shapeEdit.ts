import * as THREE from "three";
import type { Body, Feature, Shape, Vec3 } from "../types";
import { bodyMatrix, localBox, polyBounds } from "./geom";
import { snapTo } from "./units";
import { buildPattern, isPattern } from "./pattern";

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
    case "group": {
      const box = localBox(shape);
      const cur = box.max.getComponent(axis) - box.min.getComponent(axis);
      if (cur <= 0) return null;
      const f: Vec3 = [1, 1, 1];
      f[axis] = s / cur;
      return scaleGroupShape(shape, box.min.toArray() as Vec3, f).shape;
    }
  }
}

/* ------------------------------------------------------------------ */
/* scaling combined bodies                                              */
/* ------------------------------------------------------------------ */

const mulV = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** moves feature references along with a scaling about `anchor` (fillet radii etc. stay as they are) */
export function scaleFeaturesAbout(features: Feature[], anchor: Vec3, f: Vec3): Feature[] {
  if (f.every((k) => Math.abs(k - 1) < 1e-12)) return features;
  const P = (p: Vec3): Vec3 => [anchor[0] + (p[0] - anchor[0]) * f[0], anchor[1] + (p[1] - anchor[1]) * f[1], anchor[2] + (p[2] - anchor[2]) * f[2]];
  const D = (d: Vec3) => norm(mulV(d, f));
  const N = (n: Vec3) => norm([n[0] / f[0], n[1] / f[1], n[2] / f[2]]);
  return features.map((ft) => {
    if (ft.type === "fillet" || ft.type === "chamfer") return { ...ft, edges: ft.edges.map((e) => ({ mid: P(e.mid), dir: D(e.dir) })) };
    if (ft.type === "push") return { ...ft, face: { center: P(ft.face.center), normal: N(ft.face.normal) } };
    if (ft.type !== "tilt") return ft;
    return { ...ft, face: { center: P(ft.face.center), normal: N(ft.face.normal) }, hinge: { mid: P(ft.hinge.mid), dir: D(ft.hinge.dir) } };
  });
}

/** factors given along the parent's axes, expressed along the body's own axes (null if not 90°-aligned) */
function localFactors(body: Pick<Body, "quaternion">, f: Vec3): Vec3 | null {
  const out: Vec3 = [1, 1, 1];
  for (let a = 0; a < 3; a++) {
    const l = alignedLocalAxis(body as Body, a);
    if (l === null) return null;
    out[l] = f[a];
  }
  return out;
}

/**
 * Scales a body (placed in its parent frame) about `anchor` by per-axis factors.
 * Everything stays parametric: sizes and positions change, round parts stay round.
 */
export function scaleBodyAbout(body: Body, anchor: Vec3, f: Vec3): { body: Body; approx: boolean } {
  const m = bodyMatrix(body);
  const inv = m.clone().invert();
  const lf = localFactors(body, f);
  const before = localBox(body.shape).applyMatrix4(m);
  const center = before.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3(...anchor).add(center.clone().sub(new THREE.Vector3(...anchor)).multiply(new THREE.Vector3(...f)));
  if (!lf) {
    // freely rotated part: only its position follows
    const d = target.sub(center);
    return { body: { ...body, position: [r6(body.position[0] + d.x), r6(body.position[1] + d.y), r6(body.position[2] + d.z)] }, approx: true };
  }
  let shape: Shape = body.shape;
  let approx = false;
  let features = body.features;
  if (shape.kind === "group") {
    const localAnchor = new THREE.Vector3(...anchor).applyMatrix4(inv).toArray() as Vec3;
    const r = scaleGroupShape(shape, localAnchor, lf);
    shape = r.shape;
    approx = r.approx;
    features = scaleFeaturesAbout(features, localAnchor, lf);
    // the children moved inside the group's own frame: nothing to shift
    return { body: { ...body, shape, features }, approx };
  }
  // round parts stay round: across their axis they only grow as much as the smaller stretch allows
  const k = shape.kind;
  if (k === "cylinder" || k === "tube" || k === "cone") {
    const r = Math.min(lf[0], lf[1]);
    approx ||= Math.abs(lf[0] - lf[1]) > 1e-9;
    lf[0] = lf[1] = r;
  } else if (k === "sphere") {
    const r = Math.min(...lf);
    approx ||= Math.max(...lf) - r > 1e-9;
    lf[0] = lf[1] = lf[2] = r;
  }
  const lb = localBox(shape);
  for (let l = 0; l < 3; l++) {
    if (Math.abs(lf[l] - 1) < 1e-12) continue;
    const size = (lb.max.getComponent(l) - lb.min.getComponent(l)) * lf[l];
    const next = resizeLocal(shape, l, size);
    if (next) shape = next;
    else approx = true;
  }
  features = scaleFeaturesAbout(features, [0, 0, 0], lf);
  // keep the part centred where the scaling puts it
  const after = localBox(shape).applyMatrix4(m).getCenter(new THREE.Vector3());
  const d = target.sub(after);
  return {
    body: { ...body, shape, features, position: [r6(body.position[0] + d.x), r6(body.position[1] + d.y), r6(body.position[2] + d.z)] },
    approx,
  };
}

/** scales a combined body about its local box (min corner; x/y centre when proportional); features follow */
export function scaleGroup(body: Body, f: Vec3, centred = false): Partial<Body> | null {
  if (body.shape.kind !== "group") return null;
  const box = localBox(body.shape);
  const anchor = box.min.toArray() as Vec3;
  if (centred) {
    const c = box.getCenter(new THREE.Vector3());
    anchor[0] = c.x;
    anchor[1] = c.y;
  }
  const r = scaleGroupShape(body.shape, anchor, f);
  return { shape: r.shape, features: scaleFeaturesAbout(body.features, anchor, f) };
}

export function scaleGroupShape(shape: Extract<Shape, { kind: "group" }>, anchor: Vec3, f: Vec3) {
  let approx = false;
  if (isPattern(shape)) {
    // a pattern scales its original and its spacing, the copies are built again from both
    const p = shape.pattern;
    const r = scaleBodyAbout(shape.children[0], anchor, f);
    const others = [0, 1, 2].filter((a) => a !== p.circAxis);
    const pattern = {
      ...p,
      spacing: r6(p.spacing * f[p.axis]),
      rowSpacing: r6(p.rowSpacing * f[p.rowAxis]),
      radius: r6((p.radius * (f[others[0]] + f[others[1]])) / 2),
      center: p.center.map((v, a) => r6(anchor[a] + (v - anchor[a]) * f[a])) as Vec3,
    };
    return { shape: { ...shape, pattern, children: buildPattern(r.body, pattern) }, approx: r.approx };
  }
  const children = shape.children.map((c) => {
    const r = scaleBodyAbout(c, anchor, f);
    approx ||= r.approx;
    return r.body;
  });
  return { shape: { ...shape, children }, approx };
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
  if (body.shape.kind === "group") {
    const f: Vec3 = [1, 1, 1];
    const box = localBox(body.shape);
    const cur = box.max.getComponent(l) - box.min.getComponent(l);
    if (cur <= 0) return null;
    f[l] = Math.max(size, MIN) / cur;
    return scaleGroup(body, f);
  }
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
  /** English; translated where shown */
  label: string;
  /** returns the new shape plus a local shift of the origin */
  apply: (
    t: number,
    snap: number,
    uniform?: boolean,
  ) => { shape: Shape; shift: Vec3; value: number; mapFeatures?: (features: Feature[]) => Feature[] };
}

/** handle on the bottom face that grows a height parameter downwards */
function bottomHandle(shape: Shape & { h: number }, pos: Vec3, sn: (v: number, snap: number) => number): HandleSpec {
  return {
    id: "h-",
    pos,
    dir: [0, 0, -1],
    label: "Height (bottom)",
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
          label: ["Width", "Depth", "Height"][axis],
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
          label: "Diameter",
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
          label: "Height",
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
          label: "Ø bottom",
          apply: (t, snap) => {
            const v = Math.max(snapTo(shape.d1 + 2 * t, snap), 0);
            return { shape: { ...shape, d1: v }, shift: [0, 0, 0], value: v };
          },
        },
        {
          id: "d2",
          pos: [shape.d2 / 2, 0, shape.h],
          dir: [1, 0, 0],
          label: "Ø top",
          apply: (t, snap) => {
            const v = Math.max(snapTo(shape.d2 + 2 * t, snap), 0);
            return { shape: { ...shape, d2: v }, shift: [0, 0, 0], value: v };
          },
        },
        {
          id: "h",
          pos: [0, 0, shape.h],
          dir: [0, 0, 1],
          label: "Height",
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
          label: "Height",
          apply: (t, snap) => {
            const v = sn(shape.h + t, snap);
            return { shape: { ...shape, h: v }, shift: [0, 0, 0], value: v };
          },
        },
        bottomHandle(shape, [(pb.minX + pb.maxX) / 2, (pb.minY + pb.maxY) / 2, 0], sn),
      ];
    }
    case "group": {
      const box = localBox(shape);
      const lo = box.min.toArray() as Vec3;
      const hi = box.max.toArray() as Vec3;
      const mid = box.getCenter(new THREE.Vector3()).toArray() as Vec3;
      const side = (axis: 0 | 1 | 2, neg: boolean): HandleSpec => {
        const cur = hi[axis] - lo[axis];
        const pos: Vec3 = [...mid];
        pos[axis] = neg ? lo[axis] : hi[axis];
        const dir: Vec3 = [0, 0, 0];
        dir[axis] = neg ? -1 : 1;
        return {
          id: `${neg ? "-" : "+"}${axis}`,
          pos,
          dir,
          label: ["Width", "Depth", "Height"][axis],
          apply: (t, snap, uniform) => {
            const v = sn(cur + t, snap);
            const k = v / Math.max(cur, MIN);
            // the opposite face stays put; proportional scaling keeps the part centred and on the bed
            const anchor: Vec3 = [mid[0], mid[1], lo[2]];
            anchor[axis] = neg ? hi[axis] : lo[axis];
            const f: Vec3 = uniform ? [k, k, k] : [1, 1, 1];
            f[axis] = k;
            return {
              shape: scaleGroupShape(shape, anchor, f).shape,
              shift: [0, 0, 0],
              value: v,
              mapFeatures: (features) => scaleFeaturesAbout(features, anchor, f),
            };
          },
        };
      };
      return [side(0, false), side(0, true), side(1, false), side(1, true), side(2, false), side(2, true)];
    }
    case "imported":
      return [];
  }
}
