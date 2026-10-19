import * as THREE from "three";
import type { Body, FaceRef, Feature, MeshData, Shape, Vec3 } from "../types";
import { handleSpecs } from "../lib/shapeEdit";
import { addFeature, emptyFaceOp, noEdit, toast, updateBodies, useStore, type State } from "./store";
import { t } from "../i18n";

/**
 * A face push on an unmodified primitive is expressed through its parameters
 * (so the dimensions in the panel stay truthful); everything else becomes a feature.
 */
export function facePushAsParams(body: Body, face: FaceRef, distance: number): { shape: Shape; position: Vec3 } | null {
  if (body.features.length) return null;
  const n = new THREE.Vector3(...face.normal);
  const c = new THREE.Vector3(...face.center);
  for (const spec of handleSpecs(body.shape)) {
    if (new THREE.Vector3(...spec.dir).dot(n) < 0.999) continue;
    if (Math.abs(new THREE.Vector3(...spec.pos).sub(c).dot(n)) > 1e-3) continue;
    const r = spec.apply(distance, 0);
    const shift = new THREE.Vector3(...r.shift).applyQuaternion(new THREE.Quaternion(...body.quaternion));
    return { shape: r.shape, position: [body.position[0] + shift.x, body.position[1] + shift.y, body.position[2] + shift.z] };
  }
  return null;
}

/** The operation currently being set up in the edit mode, as a feature (or parameter change). */
function pendingFor(s: Pick<State, "tool" | "edgeSel" | "faceSel" | "fillet" | "faceOp">, body: Body) {
  if (s.tool !== "edit") return null;
  if (s.edgeSel?.bodyId === body.id && s.fillet.radius > 0 && s.edgeSel.refs.length) {
    return { feature: { id: "pending", type: s.fillet.type, radius: s.fillet.radius, edges: s.edgeSel.refs } as Feature };
  }
  if (s.faceSel?.bodyId === body.id) {
    const op = s.faceOp;
    if (op.mode === "push" && Math.abs(op.distance) > 1e-9) {
      const params = facePushAsParams(body, s.faceSel.ref, op.distance);
      if (params) return { params };
      return { feature: { id: "pending", type: "push", face: s.faceSel.ref, distance: op.distance } as Feature };
    }
    if (op.mode === "tilt" && op.hinge && Math.abs(op.angle) > 1e-9) {
      return { feature: { id: "pending", type: "tilt", face: s.faceSel.ref, hinge: op.hinge.ref, angle: op.angle } as Feature };
    }
  }
  return null;
}

/** Geometry to display for a body, including a live preview of the pending edit. */
export function displayGeometry(s: Pick<State, "tool" | "edgeSel" | "faceSel" | "fillet" | "faceOp">, body: Body) {
  const p = pendingFor(s, body);
  if (!p) return { shape: body.shape, position: body.position, features: body.features };
  if ("params" in p && p.params) return { shape: p.params.shape, position: p.params.position, features: body.features };
  return { shape: body.shape, position: body.position, features: [...body.features, p.feature!] };
}

export function hasPendingEdit() {
  const s = useStore.getState();
  const body = s.doc.bodies.find((b) => b.id === (s.edgeSel?.bodyId ?? s.faceSel?.bodyId));
  return !!body && !!pendingFor(s, body);
}

export function applyEdit() {
  const s = useStore.getState();
  const body = s.doc.bodies.find((b) => b.id === (s.edgeSel?.bodyId ?? s.faceSel?.bodyId));
  if (!body) return;
  const p = pendingFor(s, body);
  if (!p) return;
  if ("params" in p && p.params) updateBodies({ [body.id]: { shape: p.params.shape, position: p.params.position } });
  else if (p.feature) {
    const { id: _id, ...feature } = p.feature;
    addFeature(body.id, feature);
  }
  useStore.setState({ ...noEdit, faceOp: emptyFaceOp(), fillet: { ...s.fillet, radius: 0 } });
}

export function clearEditSelection() {
  useStore.setState({ ...noEdit, faceOp: emptyFaceOp(), fillet: { ...useStore.getState().fillet, radius: 0 } });
}

export function selectFace(bodyId: string, mesh: MeshData, idx: number) {
  const f = mesh.faces[idx];
  if (!f?.normal || !f.center) {
    toast(t("Only flat faces can be pushed or tilted"));
    return;
  }
  useStore.setState({
    ...noEdit,
    selection: [bodyId],
    faceSel: { bodyId, idx, ref: { center: f.center, normal: f.normal } },
    faceOp: emptyFaceOp(),
  });
}

/** Extent of a face measured from a hinge edge (for the tilt handle). */
export function faceExtentFromHinge(mesh: MeshData, faceIdx: number, hingeIdx: number) {
  const face = mesh.faces[faceIdx];
  const edge = mesh.edges[hingeIdx];
  if (!face?.normal || !edge) return null;
  const n = new THREE.Vector3(...face.normal);
  const e = new THREE.Vector3(...edge.dir).normalize();
  const p0 = new THREE.Vector3(...edge.mid);
  let u = n.clone().cross(e).normalize();
  if (face.center && new THREE.Vector3(...face.center).sub(p0).dot(u) < 0) u = u.negate();
  let w = 0;
  const P = mesh.positions;
  const I = mesh.indices;
  const v = new THREE.Vector3();
  for (let k = face.start; k < face.start + face.count; k++) {
    const i = I[k] * 3;
    v.set(P[i], P[i + 1], P[i + 2]).sub(p0);
    w = Math.max(w, v.dot(u));
  }
  return { n, u, e, p0, w };
}
