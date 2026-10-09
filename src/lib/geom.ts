import * as THREE from "three";
import type { Body, MeshData, Quat, Shape, Vec2, Vec3 } from "../types";
import { geometryKey } from "../cad/key";
import { useMeshes } from "../cad/client";

export const Z_UP = new THREE.Vector3(0, 0, 1);

export function bodyMatrix(b: { position: Vec3; quaternion: Quat }, target = new THREE.Matrix4()) {
  return target.compose(
    new THREE.Vector3(...b.position),
    new THREE.Quaternion(...b.quaternion),
    new THREE.Vector3(1, 1, 1),
  );
}

export function polyBounds(points: Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Analytic local bounding box (used before the kernel delivered a mesh). */
export function localBox(shape: Shape): THREE.Box3 {
  const b = new THREE.Box3();
  switch (shape.kind) {
    case "box":
    case "wedge":
      return b.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(shape.w, shape.d, shape.h));
    case "cylinder":
    case "tube": {
      const r = shape.d / 2;
      return b.set(new THREE.Vector3(-r, -r, 0), new THREE.Vector3(r, r, shape.h));
    }
    case "cone": {
      const r = Math.max(shape.d1, shape.d2) / 2;
      return b.set(new THREE.Vector3(-r, -r, 0), new THREE.Vector3(r, r, shape.h));
    }
    case "sphere": {
      const r = shape.d / 2;
      return b.set(new THREE.Vector3(-r, -r, 0), new THREE.Vector3(r, r, shape.d));
    }
    case "prism": {
      const pb = polyBounds(shape.points);
      return b.set(new THREE.Vector3(pb.minX, pb.minY, 0), new THREE.Vector3(pb.maxX, pb.maxY, shape.h));
    }
    case "imported": {
      const k = shape.scale;
      return b.set(new THREE.Vector3(...shape.min).multiplyScalar(k), new THREE.Vector3(...shape.max).multiplyScalar(k));
    }
    case "group": {
      // holes and subtracted tools do not add to the outside of the result
      const solids = shape.children.filter((c) => !c.hole);
      const parts = solids.length ? solids : shape.children;
      b.makeEmpty();
      if (shape.op === "intersect" && solids.length > 1) {
        b.copy(worldBox(solids[0]));
        for (const c of solids.slice(1)) b.intersect(worldBox(c));
        return b;
      }
      for (const c of parts) b.union(worldBox(c));
      return b;
    }
  }
}

export function meshFor(body: { shape: Shape; features: Body["features"] }): MeshData | undefined {
  return useMeshes.getState().meshes[geometryKey(body)]?.mesh;
}

const _v = new THREE.Vector3();

/** Axis aligned box of a body in its parent frame. Uses the mesh when available (exact). */
export function worldBox(
  body: Pick<Body, "shape" | "features" | "position" | "quaternion">,
  mesh: MeshData | undefined = meshFor(body),
): THREE.Box3 {
  const m = bodyMatrix(body);
  const box = new THREE.Box3();
  if (mesh && mesh.positions.length) {
    const p = mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(m);
      box.expandByPoint(_v);
    }
    return box;
  }
  return localBox(body.shape).applyMatrix4(m);
}

export function unionBox(bodies: Body[]) {
  const box = new THREE.Box3();
  for (const b of bodies) box.union(worldBox(b));
  return box;
}

export function quatMul(a: Quat, b: Quat): Quat {
  const q = new THREE.Quaternion(...a).multiply(new THREE.Quaternion(...b));
  return [q.x, q.y, q.z, q.w];
}

export function cleanQuat(q: THREE.Quaternion): Quat {
  // snap tiny float noise so 90° rotations stay exact
  const r = (v: number) => {
    const s = Math.round(v * 1e9) / 1e9;
    for (const k of [0, 0.5, Math.SQRT1_2, 1]) {
      if (Math.abs(Math.abs(s) - k) < 1e-9) return Math.sign(s) * k;
    }
    return s;
  };
  const out: Quat = [r(q.x), r(q.y), r(q.z), r(q.w)];
  const l = Math.hypot(...out);
  return out.map((v) => v / l) as Quat;
}

export function eulerDeg(q: Quat): Vec3 {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...q), "XYZ");
  const d = (v: number) => {
    const r = Math.round(THREE.MathUtils.radToDeg(v) * 1000) / 1000;
    return Object.is(r, -0) ? 0 : r;
  };
  return [d(e.x), d(e.y), d(e.z)];
}

export function quatFromEulerDeg(e: Vec3): Quat {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(e[0]), THREE.MathUtils.degToRad(e[1]), THREE.MathUtils.degToRad(e[2]), "XYZ"),
  );
  return cleanQuat(q);
}

export function polygonArea(points: Vec2[]) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function segmentsIntersect(points: Vec2[]) {
  const n = points.length;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < n; i++) {
    const a1 = points[i], a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const b1 = points[j], b2 = points[(j + 1) % n];
      const d1 = cross(b1, b2, a1), d2 = cross(b1, b2, a2), d3 = cross(a1, a2, b1), d4 = cross(a1, a2, b2);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    }
  }
  return false;
}
