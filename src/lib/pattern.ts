import * as THREE from "three";
import type { Body, PatternSpec, Shape, Vec3 } from "../types";
import { bodyMatrix, cleanQuat, localBox } from "./geom";

/** a group that repeats its first child */
export type PatternShape = Extract<Shape, { kind: "group" }> & { pattern: PatternSpec };

export const isPattern = (shape: Shape): shape is PatternShape => shape.kind === "group" && !!shape.pattern;

export const MAX_PATTERN = 400;

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

/** analytic box of a part in its parent frame (independent of meshes, so the pattern is reproducible) */
function partBox(b: Body) {
  return localBox(b.shape).applyMatrix4(bodyMatrix(b));
}

export function partCenter(b: Body): THREE.Vector3 {
  return localBox(b.shape).getCenter(new THREE.Vector3()).applyMatrix4(bodyMatrix(b));
}

export function partSize(b: Body, axis: number): number {
  const box = partBox(b);
  return box.max.getComponent(axis) - box.min.getComponent(axis);
}

/** the first axis that is not `axis` (start direction of a circle around it) */
const startDir = (axis: number) => AXES[axis === 0 ? 1 : 0].clone();

/** distance between neighbours on the circle */
export function circleStep(spec: PatternSpec): number {
  const n = Math.max(1, spec.count);
  if (n < 2) return 0;
  const full = spec.angle >= 360 - 1e-9;
  return THREE.MathUtils.degToRad(full ? 360 / n : spec.angle / (n - 1));
}

export const neighbourDistance = (spec: PatternSpec) => 2 * spec.radius * Math.sin(circleStep(spec) / 2);

/** centre to centre step of a linear direction */
export function pitch(src: Body, spec: PatternSpec, second = false): number {
  const value = second ? spec.rowSpacing : spec.spacing;
  if (!spec.gap) return value;
  return value + partSize(src, second ? spec.rowAxis : spec.axis);
}

export function totalCount(spec: PatternSpec) {
  return spec.type === "linear" ? spec.count * spec.rows : spec.count;
}

/** keeps the values in a range the kernel can handle */
export function cleanSpec(spec: PatternSpec): PatternSpec {
  const s = { ...spec };
  s.count = Math.max(1, Math.min(MAX_PATTERN, Math.round(s.count) || 1));
  s.rows = Math.max(1, Math.min(MAX_PATTERN, Math.round(s.rows) || 1));
  if (s.type === "linear" && s.count * s.rows > MAX_PATTERN) s.rows = Math.max(1, Math.floor(MAX_PATTERN / s.count));
  if (s.rowAxis === s.axis) s.rowAxis = s.axis === 1 ? 0 : 1;
  s.angle = Math.max(1, Math.min(360, s.angle));
  s.radius = Math.max(0, s.radius);
  return s;
}

/** where the circle sits when a part starts turning around `axis` */
export function centerFor(src: Body, radius: number, axis: 0 | 1 | 2): Vec3 {
  const c = partCenter(src).sub(startDir(axis).multiplyScalar(radius));
  return [r6(c.x), r6(c.y), r6(c.z)];
}

function copyOf(src: Body, i: number, position: Vec3, quaternion = src.quaternion): Body {
  const copy: Body = structuredClone(src);
  const reid = (x: Body, path: string) => {
    x.id = `${path}`;
    if (x.shape.kind === "group") x.shape.children.forEach((c, k) => reid(c, `${path}.${k}`));
  };
  reid(copy, `${src.id}~${i}`);
  copy.name = `${src.name} (${i + 1})`;
  copy.position = position.map(r6) as Vec3;
  copy.quaternion = quaternion;
  copy.hidden = false;
  return copy;
}

/**
 * All parts of a pattern: the original first (moved onto the circle for circular patterns),
 * then the copies.
 */
export function buildPattern(original: Body, raw: PatternSpec): Body[] {
  const spec = cleanSpec(raw);
  const src = { ...original, hidden: false };
  const out: Body[] = [];
  if (spec.type === "linear") {
    const a = AXES[spec.axis].clone().multiplyScalar(pitch(src, spec));
    const b = AXES[spec.rowAxis].clone().multiplyScalar(pitch(src, spec, true));
    out.push(src);
    let n = 0;
    for (let j = 0; j < spec.rows; j++) {
      for (let i = 0; i < spec.count; i++) {
        if (!i && !j) continue;
        const d = a.clone().multiplyScalar(i).add(b.clone().multiplyScalar(j));
        out.push(copyOf(src, ++n, [src.position[0] + d.x, src.position[1] + d.y, src.position[2] + d.z]));
      }
    }
    return out;
  }
  const axis = AXES[spec.circAxis];
  const center = new THREE.Vector3(...spec.center);
  // the original keeps its direction from the centre, at the chosen radius
  const c0 = partCenter(src);
  const rel = c0.clone().sub(center);
  const along = axis.clone().multiplyScalar(rel.dot(axis));
  const radial = rel.clone().sub(along);
  const dir = radial.length() > 1e-9 ? radial.normalize() : startDir(spec.circAxis);
  const move = dir.multiplyScalar(spec.radius).add(along).add(center).sub(c0);
  const first: Body = { ...src, position: [r6(src.position[0] + move.x), r6(src.position[1] + move.y), r6(src.position[2] + move.z)] };
  out.push(first);
  const p0 = new THREE.Vector3(...first.position);
  const q0 = new THREE.Quaternion(...first.quaternion);
  const cFirst = c0.clone().add(move);
  const step = circleStep(spec);
  for (let i = 1; i < spec.count; i++) {
    const r = new THREE.Quaternion().setFromAxisAngle(axis, step * i);
    if (spec.rotate) {
      const p = p0.clone().sub(center).applyQuaternion(r).add(center);
      out.push(copyOf(first, i, [p.x, p.y, p.z], cleanQuat(r.clone().multiply(q0))));
    } else {
      const c = cFirst.clone().sub(center).applyQuaternion(r).add(center);
      const p = p0.clone().add(c.sub(cFirst));
      out.push(copyOf(first, i, [p.x, p.y, p.z]));
    }
  }
  return out;
}

/** a useful first pattern for a part: neighbours a bit apart, on the grid */
export function defaultPattern(src: Body, type: PatternSpec["type"], snap: number): PatternSpec {
  const step = snap > 0 ? snap : 1;
  const up = (v: number) => Math.max(step, Math.ceil(v / step - 1e-9) * step);
  const sx = partSize(src, 0);
  const sy = partSize(src, 1);
  // the part's footprint decides the spacing
  const gapX = Math.max(2, sx * 0.5);
  const count = type === "circular" ? 6 : 4;
  const size = Math.max(sx, sy);
  const radius = up((size * 1.5) / (2 * Math.sin(Math.PI / count)));
  return {
    type,
    count,
    spacing: up(sx + gapX),
    axis: 0,
    rows: 1,
    rowSpacing: up(sy + Math.max(2, sy * 0.5)),
    rowAxis: 1,
    gap: false,
    radius,
    angle: 360,
    rotate: true,
    circAxis: 2,
    center: centerFor(src, radius, 2),
  };
}

/** the same pattern with other values, copies built again */
export function withPattern(shape: PatternShape, patch: Partial<PatternSpec>, snap: number): PatternShape {
  const src = shape.children[0];
  const pattern = nextSpec(src, shape.pattern, patch, snap);
  return { ...shape, pattern, children: buildPattern(src, pattern) };
}

/** the same pattern with a changed original; every copy follows */
export function withOriginal(shape: PatternShape, patch: Partial<Body>): PatternShape {
  const src = { ...shape.children[0], ...patch };
  return { ...shape, children: buildPattern(src, shape.pattern) };
}

/** turns a pattern into another pattern with the given values (keeping the circle centre fixed where possible) */
export function nextSpec(src: Body, spec: PatternSpec, patch: Partial<PatternSpec>, snap: number): PatternSpec {
  let next = { ...spec, ...patch };
  // a step given as a gap now means the same centre distance as before
  if (patch.gap !== undefined && patch.gap !== spec.gap && patch.spacing === undefined) {
    const sx = partSize(src, spec.axis);
    const sy = partSize(src, spec.rowAxis);
    const k = patch.gap ? -1 : 1;
    next.spacing = r6(spec.spacing + k * sx);
    next.rowSpacing = r6(spec.rowSpacing + k * sy);
  }
  if ((patch.type === "circular" && spec.type !== "circular") || (patch.circAxis !== undefined && patch.circAxis !== spec.circAxis)) {
    if (!(next.radius > 0)) next.radius = defaultPattern(src, "circular", snap).radius;
    next.center = centerFor(src, next.radius, next.circAxis);
  }
  next = cleanSpec(next);
  return next;
}
