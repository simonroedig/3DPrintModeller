import * as THREE from "three";
import type { Body, StretchFeature } from "../types";
import { bodyMatrix } from "./geom";
import { alignedLocalAxis } from "./shapeEdit";

/**
 * A stretch is stored in the body's own frame. These helpers translate it to the world (which axis,
 * where the cut is, which end moves) and back, for the panel and the handles in the model.
 */
export function stretchInWorld(body: Body, f: StretchFeature) {
  const m = bodyMatrix(body);
  const dir = new THREE.Vector3().setComponent(f.axis, 1).applyQuaternion(new THREE.Quaternion(...body.quaternion));
  const abs = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
  const axis = abs.indexOf(Math.max(...abs)) as 0 | 1 | 2;
  const p = new THREE.Vector3().setComponent(f.axis, f.at).applyMatrix4(m);
  /** +1: the part on the world's plus side moves, -1: the part on the minus side */
  const sign = dir.getComponent(axis) >= 0 ? 1 : -1;
  return { axis, at: p.getComponent(axis), sign };
}

/** the body's own axis and coordinate for a cut across a world axis at a world position (null if turned at an odd angle) */
export function stretchFromWorld(body: Body, axis: 0 | 1 | 2, worldAt: number): { axis: 0 | 1 | 2; at: number } | null {
  const l = alignedLocalAxis(body, axis);
  if (l === null) return null;
  const inv = bodyMatrix(body).invert();
  const p = new THREE.Vector3().setComponent(axis, worldAt).applyMatrix4(inv);
  return { axis: l as 0 | 1 | 2, at: Math.round(p.getComponent(l) * 1e6) / 1e6 };
}

/** the zone that gets stretched when none was set (older files) */
export const zoneOf = (f: StretchFeature) => f.zone ?? Math.max(2 * Math.abs(f.amount), 10);

/** world position along the stretch's world axis of a coordinate along the body's own axis */
export function worldAlong(body: Body, f: StretchFeature, local: number): number {
  const p = new THREE.Vector3().setComponent(f.axis, local).applyMatrix4(bodyMatrix(body));
  return p.getComponent(stretchInWorld(body, f).axis);
}

/** a first zone: a third of the length, on the grid */
export function defaultZone(length: number, snap: number) {
  const step = snap > 0 ? snap : 1;
  return Math.max(step, Math.round(length / 3 / step) * step);
}
