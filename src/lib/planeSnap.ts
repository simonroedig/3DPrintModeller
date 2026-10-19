import * as THREE from "three";
import { useStore } from "../store/store";
import { bodyMatrix, meshFor, worldBox } from "./geom";
import { t } from "../i18n";

export interface PlaneSnapTarget {
  value: number;
  label: string;
}

const SIDE: Record<string, string> = { "2+": "top", "2-": "bottom", "1-": "front", "1+": "back", "0+": "right", "0-": "left" };

/**
 * Positions along a world axis where a sketch plane lines up exactly with something:
 * flat body faces perpendicular to the axis (from the CAD mesh), else the bounding box, plus the origin.
 */
export function planeSnapTargets(axis: 0 | 1 | 2): PlaneSnapTarget[] {
  const { doc } = useStore.getState();
  const out: PlaneSnapTarget[] = [{ value: 0, label: axis === 2 ? t("Print bed") : t("Origin") }];
  const n = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const b of doc.bodies) {
    if (b.hidden) continue;
    const mesh = meshFor(b);
    const faces = mesh?.faces.filter((f) => f.normal && f.center) ?? [];
    if (faces.length) {
      const m = bodyMatrix(b);
      const q = new THREE.Quaternion(...b.quaternion);
      for (const f of faces) {
        n.set(...f.normal!).applyQuaternion(q);
        if (Math.abs(n.getComponent(axis)) < 0.999) continue;
        c.set(...f.center!).applyMatrix4(m);
        out.push({ value: c.getComponent(axis), label: `${b.name} · ${t(SIDE[`${axis}${n.getComponent(axis) > 0 ? "+" : "-"}`])}` });
      }
    } else {
      const box = worldBox(b);
      if (box.isEmpty()) continue;
      out.push({ value: box.min.getComponent(axis), label: `${b.name} · ${t(SIDE[`${axis}-`])}` });
      out.push({ value: box.max.getComponent(axis), label: `${b.name} · ${t(SIDE[`${axis}+`])}` });
    }
  }
  // one entry per position
  const seen: PlaneSnapTarget[] = [];
  for (const t of out) {
    t.value = Math.round(t.value * 1e4) / 1e4;
    if (!seen.some((s) => Math.abs(s.value - t.value) < 1e-3)) seen.push(t);
  }
  return seen.sort((a, b) => a.value - b.value);
}
