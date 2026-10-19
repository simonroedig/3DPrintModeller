import * as THREE from "three";
import type { PlaneOrient, SketchPlane, Vec3 } from "../types";

export type ViewName = "iso" | "top" | "bottom" | "front" | "back" | "right" | "left";

/** direction from the scene towards the camera */
export const VIEW_DIR: Record<ViewName, THREE.Vector3> = {
  iso: new THREE.Vector3(0.75, -1.25, 0.95).normalize(),
  top: new THREE.Vector3(0, 0, 1),
  bottom: new THREE.Vector3(0, 0, -1),
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
};

/** world axis looked along in a 2D view (null for 3D) */
export function viewAxis(view: ViewName): 0 | 1 | 2 | null {
  if (view === "top" || view === "bottom") return 2;
  if (view === "front" || view === "back") return 1;
  if (view === "right" || view === "left") return 0;
  return null;
}

/** colours of the world axes (X red, Y green, Z blue) */
export const AXIS_COLOR = ["#ef4444", "#22c55e", "#3b82f6"] as const;

export function axisColorOf(dir: THREE.Vector3 | Vec3) {
  const d = dir instanceof THREE.Vector3 ? dir : new THREE.Vector3(...dir);
  const a = [Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)];
  return AXIS_COLOR[a.indexOf(Math.max(...a))];
}

/* ------------------------------------------------------------------ */
/* sketch planes                                                        */
/* ------------------------------------------------------------------ */

export const PLANE_AXIS: Record<PlaneOrient, 0 | 1 | 2> = { top: 2, bottom: 2, front: 1, back: 1, right: 0, left: 0 };
export const PLANE_AXIS_NAME = ["X", "Y", "Z"] as const;

/** sketch u/v axes and normal (u × v = n), matching what the camera of that view sees */
const BASIS: Record<PlaneOrient, [Vec3, Vec3, Vec3]> = {
  top: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  // seen from below: X stays right, Y points down the screen
  bottom: [[1, 0, 0], [0, -1, 0], [0, 0, -1]],
  front: [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  back: [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  right: [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  left: [[0, -1, 0], [0, 0, 1], [-1, 0, 0]],
};

export function planeBasis(orient: PlaneOrient) {
  const [u, v, n] = BASIS[orient];
  return { u: new THREE.Vector3(...u), v: new THREE.Vector3(...v), n: new THREE.Vector3(...n) };
}

export function planeOrigin(plane: SketchPlane) {
  const o = new THREE.Vector3();
  o.setComponent(PLANE_AXIS[plane.orient], plane.value);
  return o;
}

/** local (u, v, n) → world */
export function planeMatrix(plane: SketchPlane) {
  const { u, v, n } = planeBasis(plane.orient);
  const m = new THREE.Matrix4().makeBasis(u, v, n);
  m.setPosition(planeOrigin(plane));
  return m;
}

export function planeQuat(orient: PlaneOrient): [number, number, number, number] {
  const { u, v, n } = planeBasis(orient);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
  return [q.x, q.y, q.z, q.w];
}

export function toPlane2D(plane: SketchPlane, p: THREE.Vector3): [number, number] {
  const { u, v } = planeBasis(plane.orient);
  const d = p.clone().sub(planeOrigin(plane));
  return [d.dot(u), d.dot(v)];
}

export function fromPlane2D(plane: SketchPlane, x: number, y: number, z = 0) {
  const { u, v, n } = planeBasis(plane.orient);
  return planeOrigin(plane).addScaledVector(u, x).addScaledVector(v, y).addScaledVector(n, z);
}

export function orientForView(view: ViewName): PlaneOrient {
  return view === "iso" ? "top" : view;
}

export const ORIENT_LABEL: Record<PlaneOrient, string> = {
  top: "Floor (XY)",
  bottom: "Bottom (XY)",
  front: "Front (XZ)",
  back: "Back (XZ)",
  right: "Right (YZ)",
  left: "Left (YZ)",
};
