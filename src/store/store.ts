import { create } from "zustand";
import * as THREE from "three";
import type { Asset, Body, BoolOp, Doc, EdgeRef, PlaneOrient, SketchPlane, FaceRef, Feature, Quat, Settings, Shape, ShapeKind, Sketch, SketchShape, Unit, Vec2, Vec3 } from "../types";
import { DEFAULT_SNAP, fmtLen } from "../lib/units";
import { idbGet, idbSet } from "../lib/persist";
import { fromPlane2D, orientForView, PLANE_AXIS, PLANE_AXIS_NAME, planeQuat } from "../lib/planes";
import { assetPayload, importAsset, isAssetRegistered, registerAsset, setRestartHandler } from "../cad/client";
import { BREP_TRIANGLE_LIMIT } from "../cad/regions";
import { detectFormat, payloadFromAsset, toBase64 } from "../cad/importers";
import { cleanQuat, localBox, polyBounds, polygonArea, quatFromEulerDeg, unionBox, worldBox } from "../lib/geom";

export type Tool = "select" | "rect" | "circle" | "poly" | "edit" | "layflat";
export type View = "iso" | "top" | "front" | "back" | "right" | "left";

export interface Guide {
  a: Vec3;
  b: Vec3;
}

export interface EdgeSelection {
  bodyId: string;
  /** indices into the body's current mesh edges */
  idx: number[];
  /** same edges as geometric references (body-local) */
  refs: EdgeRef[];
}

export interface FaceSelection {
  bodyId: string;
  /** index into the body's current mesh faces */
  idx: number;
  ref: FaceRef;
}

export interface FaceOp {
  mode: "push" | "tilt";
  distance: number;
  /** degrees; > 0 adds a wedge, < 0 removes one */
  angle: number;
  hinge: { idx: number; ref: EdgeRef } | null;
}

export const emptyFaceOp = (): FaceOp => ({ mode: "push", distance: 0, angle: 0, hinge: null });

/** clears every edge / face selection of the edit mode */
export const noEdit = { edgeSel: null, faceSel: null } as const;

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

export interface State {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  txBase: Doc | null;
  selection: string[];
  tool: Tool;
  rectMode: "corner" | "center";
  circleMode: "center" | "corner";
  view: View;
  fitNonce: number;
  edgeSel: EdgeSelection | null;
  fillet: { type: "fillet" | "chamfer"; radius: number };
  faceSel: FaceSelection | null;
  faceOp: FaceOp;
  /** bumps when the view changed on its own (so the UI can point it out) */
  viewFlash: number;
  /** view button under the mouse – the viewport shows where that view looks from */
  viewHover: View | null;
  guides: Guide[];
  dragInfo: string | null;
  startDialog: boolean;
  exportOpen: boolean;
  helpOpen: boolean;
  toasts: Toast[];
  /** plane position (along its axis) per sketch orientation */
  sketchPlanes: Record<PlaneOrient, number>;
  /** next click on a flat face of a body sets the sketch plane */
  planePick: boolean;
  /** the sketch plane is being dragged in the plane preview */
  planeDrag: boolean;
  /** part of a combined body opened in the panel (shown in the viewport) */
  groupFocus: { groupId: string; childId: string } | null;
}

const STORAGE_KEY = "printmodeller.doc.v1";

export const defaultSettings = (unit: Unit = "mm"): Settings => ({
  unit,
  snap: DEFAULT_SNAP[unit],
  bed: { x: 256, y: 256 },
});

const emptyDoc = (unit: Unit = "mm"): Doc => ({ bodies: [], sketches: [], settings: defaultSettings(unit) });

function loadDoc(): Doc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Doc;
    if (!Array.isArray(d.bodies) || !d.settings) return null;
    return normalizeDoc(d);
  } catch {
    return null;
  }
}

const initialDoc = loadDoc();

export const useStore = create<State>(() => ({
  doc: initialDoc ?? emptyDoc(),
  past: [],
  future: [],
  txBase: null,
  selection: [],
  tool: "select",
  rectMode: "corner",
  circleMode: "center",
  view: "iso",
  fitNonce: 0,
  ...noEdit,
  fillet: { type: "fillet", radius: 0 },
  faceOp: emptyFaceOp(),
  viewFlash: 0,
  viewHover: null,
  guides: [],
  dragInfo: null,
  // decided once the IndexedDB copy has been checked (see hydrate below)
  startDialog: false,
  exportOpen: false,
  helpOpen: false,
  toasts: [],
  sketchPlanes: { top: 0, front: 0, back: 0, right: 0, left: 0 },
  planePick: false,
  planeDrag: false,
  groupFocus: null,
}));

const get = useStore.getState;
const set = useStore.setState;

/** make every imported file of the document known to the CAD worker (before any meshing) */
function syncAssets(doc: Doc) {
  for (const [id, asset] of Object.entries(doc.assets ?? {})) {
    if (isAssetRegistered(id)) continue;
    try {
      registerAsset(id, assetPayload(id) ?? payloadFromAsset(asset));
    } catch (err) {
      console.error("asset", asset.name, err);
    }
  }
}
syncAssets(get().doc);
set({ doc: keepHeavyMeshesAsMesh(get().doc) });
setRestartHandler(() => syncAssets(get().doc));

/** documents from older versions may hold huge meshes as CAD bodies – show those as plain meshes */
function keepHeavyMeshesAsMesh(doc: Doc): Doc {
  let changed = false;
  const fix = (b: Body): Body => {
    if (b.shape.kind === "group") {
      const children = b.shape.children.map(fix);
      return children.some((c, i) => c !== (b.shape as { children: Body[] }).children[i]) ? { ...b, shape: { ...b.shape, children } } : b;
    }
    if (b.shape.kind !== "imported" || b.shape.mode === "mesh") return b;
    const payload = assetPayload(b.shape.asset);
    if (payload?.format !== "mesh") return b;
    const tris = payload.parts.reduce((n, p) => n + p.indices.length / 3, 0);
    if (tris <= BREP_TRIANGLE_LIMIT || payload.parts.length <= b.shape.part) return b;
    changed = true;
    const box = new THREE.Box3().setFromArray(payload.parts[b.shape.part].positions);
    return { ...b, features: [], shape: { ...b.shape, mode: "mesh", min: box.min.toArray() as Vec3, max: box.max.toArray() as Vec3 } };
  };
  const bodies = doc.bodies.map(fix);
  return changed ? { ...doc, bodies } : doc;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let hydrated = false;
useStore.subscribe((s, prev) => {
  if (s.doc === prev.doc) return;
  syncAssets(s.doc);
  if (!hydrated) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const doc = get().doc;
    idbSet(STORAGE_KEY, doc).catch(() => {});
    try {
      // small documents also go to localStorage (fallback when IndexedDB is unavailable)
      if (doc.assets && Object.keys(doc.assets).length) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      /* quota */
    }
  }, 400);
});

// the IndexedDB copy is authoritative (it can hold imported files)
idbGet<Doc>(STORAGE_KEY)
  .then((saved) => {
    hydrated = true;
    if (saved && Array.isArray(saved.bodies) && saved.settings) {
      normalizeDoc(saved);
      syncAssets(saved);
      set({ doc: keepHeavyMeshesAsMesh(saved), startDialog: false, fitNonce: get().fitNonce + 1 });
    } else if (!initialDoc) set({ startDialog: true });
  })
  .catch(() => {
    hydrated = true;
    if (!initialDoc) set({ startDialog: true });
  });

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const uid = () => Math.random().toString(36).slice(2, 10);

export const KIND_LABEL: Record<ShapeKind, string> = {
  box: "Quader",
  wedge: "Keil",
  cylinder: "Zylinder",
  cone: "Kegel",
  sphere: "Kugel",
  tube: "Rohr",
  prism: "Prisma",
  group: "Gruppe",
  imported: "Import",
};

const PALETTE = ["#4f8ff7", "#f5a524", "#22c55e", "#ef4444", "#a855f7", "#14b8a6", "#f97316", "#e879f9"];

function nextName(doc: Doc, base: string) {
  let n = 0;
  const re = new RegExp(`^${base} (\\d+)$`);
  for (const b of doc.bodies) {
    const m = re.exec(b.name);
    if (m) n = Math.max(n, Number(m[1]));
  }
  for (const s of doc.sketches) {
    const m = re.exec(s.name);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `${base} ${n + 1}`;
}

function nextColor(doc: Doc) {
  return PALETTE[doc.bodies.length % PALETTE.length];
}

export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = Date.now() + Math.random();
  set({ toasts: [...get().toasts, { id, text, kind }] });
  setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === "error" ? 6000 : 3500);
}

/** Apply a document change (recorded in history unless a transaction is open). */
export function commit(next: Doc) {
  const s = get();
  if (next === s.doc) return;
  if (s.txBase) {
    set({ doc: next });
    return;
  }
  set({ doc: next, past: [...s.past.slice(-150), s.doc], future: [] });
}

export function beginTx() {
  const s = get();
  if (!s.txBase) set({ txBase: s.doc });
}

export function endTx() {
  const s = get();
  if (!s.txBase) return;
  if (s.txBase !== s.doc) set({ past: [...s.past.slice(-150), s.txBase], future: [], txBase: null });
  else set({ txBase: null });
}

export function cancelTx() {
  const s = get();
  if (s.txBase) set({ doc: s.txBase, txBase: null });
}

export function undo() {
  const s = get();
  if (s.txBase || !s.past.length) return;
  const prev = s.past[s.past.length - 1];
  set({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], ...noEdit });
  pruneSelection();
}

export function redo() {
  const s = get();
  if (s.txBase || !s.future.length) return;
  const [next, ...rest] = s.future;
  set({ doc: next, past: [...s.past, s.doc], future: rest, ...noEdit });
  pruneSelection();
}

function pruneSelection() {
  const { doc, selection } = get();
  const ids = new Set([...doc.bodies.map((b) => b.id), ...doc.sketches.map((s) => s.id)]);
  set({ selection: selection.filter((id) => ids.has(id)) });
}

export function getBody(id: string) {
  return get().doc.bodies.find((b) => b.id === id);
}

export function updateBodies(updates: Record<string, Partial<Body>>) {
  const doc = get().doc;
  commit({
    ...doc,
    bodies: doc.bodies.map((b) => (updates[b.id] ? { ...b, ...updates[b.id] } : b)),
  });
}

export function updateBody(id: string, patch: Partial<Body>) {
  updateBodies({ [id]: patch });
}

export function selectedBodies() {
  const { doc, selection } = get();
  return doc.bodies.filter((b) => selection.includes(b.id));
}

export function select(ids: string[]) {
  set({ selection: ids, ...noEdit, groupFocus: null });
}

export function setTool(tool: Tool) {
  const s = get();
  if (s.tool === tool && !s.edgeSel && !s.faceSel) return;
  set({ tool, ...noEdit, planePick: false });
}

export function setView(view: View) {
  set({ view, fitNonce: get().fitNonce + 1 });
}

export function fitView() {
  set({ fitNonce: get().fitNonce + 1 });
}

/* ------------------------------------------------------------------ */
/* creation                                                             */
/* ------------------------------------------------------------------ */

export function defaultShape(kind: Exclude<ShapeKind, "group" | "prism" | "imported">): Shape {
  switch (kind) {
    case "box":
      return { kind, w: 20, d: 20, h: 20 };
    case "wedge":
      return { kind, w: 20, d: 40, h: 15 };
    case "cylinder":
      return { kind, d: 20, h: 20 };
    case "cone":
      return { kind, d1: 20, d2: 0, h: 20 };
    case "sphere":
      return { kind, d: 20 };
    case "tube":
      return { kind, d: 20, t: 2, h: 20 };
  }
}

function makeBody(doc: Doc, shape: Shape, extra: Partial<Body> = {}): Body {
  return {
    id: uid(),
    name: nextName(doc, KIND_LABEL[shape.kind]),
    shape,
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    hole: false,
    color: nextColor(doc),
    features: [],
    ...extra,
  };
}

/** finds a free spot on the bed next to existing geometry */
function placeNewBody(doc: Doc, shape: Shape): Vec3 {
  const lb = localBox(shape);
  const size = lb.getSize(new THREE.Vector3());
  const visible = doc.bodies.filter((b) => !b.hidden);
  if (!visible.length) {
    const snap = doc.settings.snap || 1;
    const minX = Math.round(-size.x / 2 / snap) * snap;
    const minY = Math.round(-size.y / 2 / snap) * snap;
    return [minX - lb.min.x, minY - lb.min.y, -lb.min.z];
  }
  const all = unionBox(visible);
  const gap = 10;
  return [all.max.x + gap - lb.min.x, all.min.y - lb.min.y, -lb.min.z];
}

export function addPrimitive(kind: Exclude<ShapeKind, "group" | "prism" | "imported">, hole = false) {
  const doc = get().doc;
  const shape = defaultShape(kind);
  const body = makeBody(doc, shape, { hole });
  if (hole) body.name = `Loch ${body.name}`;
  body.position = placeNewBody(doc, shape);
  commit({ ...doc, bodies: [...doc.bodies, body] });
  set({ selection: [body.id], tool: "select", ...noEdit });
}

/** plane new sketches are drawn on: follows the current view (3D view → floor) */
export function currentSketchPlane(): SketchPlane {
  const s = get();
  const orient = orientForView(s.view);
  return { orient, value: s.sketchPlanes[orient] };
}

export function setSketchPlaneValue(orient: PlaneOrient, value: number) {
  set({ sketchPlanes: { ...get().sketchPlanes, [orient]: value } });
}

export const isSketchTool = (t: Tool) => t === "rect" || t === "circle" || t === "poly";

/** the plane the plane preview controls: the next sketch's (while drawing) or the selected sketch's */
export function planeTarget(s: State = get()): { plane: SketchPlane; sketch: Sketch | null } | null {
  if (isSketchTool(s.tool)) return { plane: currentSketchPlane(), sketch: null };
  if (s.tool !== "select" || s.selection.length !== 1) return null;
  const sketch = s.doc.sketches.find((k) => k.id === s.selection[0]);
  return sketch ? { plane: sketch.plane, sketch } : null;
}

export function setPlaneTargetValue(value: number) {
  const t = planeTarget();
  if (!t) return;
  const v = round6(value);
  if (t.sketch) updateSketch(t.sketch.id, t.sketch.shape, { ...t.sketch.plane, value: v });
  else setSketchPlaneValue(t.plane.orient, v);
}

/** a click on a flat body face (world normal + point) moves the sketch plane onto that face */
export function pickSketchPlane(normal: THREE.Vector3, point: THREE.Vector3) {
  set({ planePick: false });
  const a = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const axis = a.indexOf(Math.max(...a)) as 0 | 1 | 2;
  if (a[axis] < 0.999) {
    toast("Diese Fläche ist schräg – Skizzen gehen auf Flächen, die nach oben, vorne/hinten oder zur Seite zeigen", "error");
    return;
  }
  const sign = normal.getComponent(axis) > 0 ? 1 : -1;
  const orient: PlaneOrient = axis === 2 ? "top" : axis === 1 ? (sign < 0 ? "front" : "back") : sign > 0 ? "right" : "left";
  const value = Math.round(point.getComponent(axis) * 1e4) / 1e4;
  const s = get();
  const t = planeTarget(s);
  if (t?.sketch) {
    if (PLANE_AXIS[t.sketch.plane.orient] !== axis) {
      toast("Die Fläche liegt nicht parallel zu dieser Skizze", "error");
      return;
    }
    updateSketch(t.sketch.id, t.sketch.shape, { ...t.sketch.plane, value });
    return;
  }
  set({ sketchPlanes: { ...s.sketchPlanes, [orient]: value } });
  if (orientForView(s.view) !== orient) {
    // draw straight onto the face: look at it
    set({ view: orient, fitNonce: s.fitNonce + 1, viewFlash: s.viewFlash + 1 });
  }
  toast(`Skizzenebene auf Fläche gesetzt (${PLANE_AXIS_NAME[axis]} = ${fmtLen(value, s.doc.settings.unit)})`);
}

export function addSketch(shape: SketchShape) {
  const doc = get().doc;
  const sketch: Sketch = { id: uid(), name: nextName(doc, "Skizze"), plane: currentSketchPlane(), shape };
  commit({ ...doc, sketches: [...doc.sketches, sketch] });
  set({ selection: [sketch.id], ...noEdit, tool: "select" });
}

export function updateSketch(id: string, shape: SketchShape, plane?: SketchPlane) {
  const doc = get().doc;
  commit({ ...doc, sketches: doc.sketches.map((s) => (s.id === id ? { ...s, shape, plane: plane ?? s.plane } : s)) });
}

/** older documents stored sketches with a plain height `z` */
export function normalizeDoc(doc: Doc): Doc {
  doc.sketches = (doc.sketches ?? []).map((sk) => {
    const legacy = sk as Sketch & { z?: number };
    return sk.plane ? sk : { ...sk, plane: { orient: "top", value: legacy.z ?? 0 } };
  });
  return doc;
}

export function sketchToBody(doc: Doc, sketch: Sketch, height: number, hole: boolean): Body | null {
  let h = height;
  let z0 = 0; // start of the extrusion along the plane normal
  if (h < 0) {
    z0 = h;
    h = -h;
  }
  if (h < 1e-3) return null;
  const s = sketch.shape;
  const plane = sketch.plane;
  const quat = planeQuat(plane.orient);
  let shape: Shape;
  let position: Vec3;
  let quaternion: Quat = [0, 0, 0, 1];
  if (s.kind === "rect") {
    if (s.w < 1e-3 || s.d < 1e-3) return null;
    // rectangles become an axis aligned box in world space (B/T/H stay X/Y/Z)
    const box = new THREE.Box3();
    for (const [x, y, z] of [[s.x, s.y, z0], [s.x + s.w, s.y + s.d, z0 + h]]) box.expandByPoint(fromPlane2D(plane, x, y, z));
    const size = box.getSize(new THREE.Vector3());
    shape = { kind: "box", w: round6(size.x), d: round6(size.y), h: round6(size.z) };
    position = [round6(box.min.x), round6(box.min.y), round6(box.min.z)];
  } else if (s.kind === "circle") {
    if (s.d < 1e-3) return null;
    shape = { kind: "cylinder", d: s.d, h };
    position = fromPlane2D(plane, s.cx, s.cy, z0).toArray() as Vec3;
    quaternion = quat;
  } else {
    let pts = s.points;
    if (pts.length < 3) return null;
    if (polygonArea(pts) < 0) pts = [...pts].reverse();
    const pb = polyBounds(pts);
    shape = { kind: "prism", h, points: pts.map(([x, y]) => [x - pb.minX, y - pb.minY] as Vec2) };
    position = fromPlane2D(plane, pb.minX, pb.minY, z0).toArray() as Vec3;
    quaternion = quat;
  }
  const body = makeBody(doc, shape, { position: position.map(round6) as Vec3, quaternion: cleanQuat(new THREE.Quaternion(...quaternion)), hole });
  if (hole) body.name = `Loch ${body.name}`;
  return body;
}

export function extrudeSketch(id: string, height: number, hole = false) {
  const doc = get().doc;
  const sketch = doc.sketches.find((s) => s.id === id);
  if (!sketch) return;
  const body = sketchToBody(doc, sketch, height, hole);
  if (!body) {
    toast("Die Skizze ist zu klein zum Extrudieren", "error");
    return;
  }
  commit({ ...doc, bodies: [...doc.bodies, body], sketches: doc.sketches.filter((s) => s.id !== id) });
  set({ selection: [body.id], tool: "select" });
}

/* ------------------------------------------------------------------ */
/* editing                                                              */
/* ------------------------------------------------------------------ */

export function translateBodies(ids: string[], delta: Vec3, from?: Record<string, Vec3>) {
  const updates: Record<string, Partial<Body>> = {};
  for (const b of get().doc.bodies) {
    if (!ids.includes(b.id)) continue;
    const p = from?.[b.id] ?? b.position;
    updates[b.id] = { position: [p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]] };
  }
  updateBodies(updates);
}

/** Set the world bounding box minimum of the selection on one axis. */
export function setSelectionMin(axis: 0 | 1 | 2, value: number) {
  const bodies = selectedBodies();
  if (!bodies.length) return;
  const box = unionBox(bodies);
  const delta: Vec3 = [0, 0, 0];
  delta[axis] = value - box.min.getComponent(axis);
  translateBodies(
    bodies.map((b) => b.id),
    delta,
  );
}

/** Re-orients bodies, keeping the xy-centre and bottom height of their joint bounding box. */
function reorient(bodies: Body[], compute: (b: Body) => Quat, bottom?: number) {
  const before = unionBox(bodies);
  const c = before.getCenter(new THREE.Vector3());
  const rotated = bodies.map((b) => {
    const q0 = new THREE.Quaternion(...b.quaternion);
    const q1 = new THREE.Quaternion(...compute(b));
    // rotation that maps old orientation to new: r = q1 * q0^-1
    const r = q1.clone().multiply(q0.clone().invert());
    const p = new THREE.Vector3(...b.position).sub(c).applyQuaternion(r).add(c);
    return { ...b, quaternion: cleanQuat(q1), position: [p.x, p.y, p.z] as Vec3 };
  });
  const after = unionBox(rotated);
  const ac = after.getCenter(new THREE.Vector3());
  const targetBottom = bottom ?? before.min.z;
  const d = new THREE.Vector3(c.x - ac.x, c.y - ac.y, targetBottom - after.min.z);
  const updates: Record<string, Partial<Body>> = {};
  for (const b of rotated) {
    updates[b.id] = {
      quaternion: b.quaternion,
      position: [round6(b.position[0] + d.x), round6(b.position[1] + d.y), round6(b.position[2] + d.z)],
    };
  }
  updateBodies(updates);
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function rotateSelection(axis: 0 | 1 | 2, deg: number) {
  const bodies = selectedBodies();
  if (!bodies.length) return;
  const ax = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
  const r = new THREE.Quaternion().setFromAxisAngle(ax, THREE.MathUtils.degToRad(deg));
  reorient(bodies, (b) => {
    const q = r.clone().multiply(new THREE.Quaternion(...b.quaternion));
    return [q.x, q.y, q.z, q.w];
  });
}

export function setBodyEuler(id: string, euler: Vec3) {
  const b = getBody(id);
  if (!b) return;
  reorient([b], () => quatFromEulerDeg(euler));
}

/** Rotates the body so that the given world-space face normal points down, then puts it on the bed. */
export function layFlat(id: string, worldNormal: Vec3) {
  const b = getBody(id);
  if (!b) return;
  const n = new THREE.Vector3(...worldNormal).normalize();
  const r = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 0, -1));
  reorient(
    [b],
    (body) => {
      const q = r.clone().multiply(new THREE.Quaternion(...body.quaternion));
      return [q.x, q.y, q.z, q.w];
    },
    0,
  );
}

export function dropToBed() {
  const updates: Record<string, Partial<Body>> = {};
  for (const b of selectedBodies()) {
    const box = worldBox(b);
    updates[b.id] = { position: [b.position[0], b.position[1], round6(b.position[2] - box.min.z)] };
  }
  updateBodies(updates);
}

export function deleteSelection() {
  const { doc, selection } = get();
  if (!selection.length) return;
  commit({
    ...doc,
    bodies: doc.bodies.filter((b) => !selection.includes(b.id)),
    sketches: doc.sketches.filter((s) => !selection.includes(s.id)),
  });
  set({ selection: [], ...noEdit });
}

function cloneBody(b: Body): Body {
  const copy: Body = structuredClone(b);
  const reid = (x: Body) => {
    x.id = uid();
    if (x.shape.kind === "group") x.shape.children.forEach(reid);
  };
  reid(copy);
  return copy;
}

let clipboard: Body[] = [];

export function copySelection() {
  clipboard = selectedBodies().map((b) => structuredClone(b));
}

export function paste() {
  if (!clipboard.length) return;
  insertCopies(clipboard);
}

export function duplicateSelection() {
  const bodies = selectedBodies();
  if (!bodies.length) return;
  insertCopies(bodies);
}

function insertCopies(src: Body[]) {
  const doc = get().doc;
  const box = unionBox(src);
  const dx = Math.ceil((box.max.x - box.min.x + 5) / (doc.settings.snap || 1)) * (doc.settings.snap || 1);
  const copies = src.map((b) => {
    const c = cloneBody(b);
    c.position = [c.position[0] + dx, c.position[1], c.position[2]];
    return c;
  });
  commit({ ...doc, bodies: [...doc.bodies, ...copies] });
  set({ selection: copies.map((c) => c.id), ...noEdit });
}

export const OP_NAME: Record<BoolOp, string> = { union: "Vereinigung", subtract: "Differenz", intersect: "Schnittmenge", group: "Gruppe" };

/** selected bodies in the order they were picked (for subtracting, the first one is the base) */
export function orderedSelection(): Body[] {
  const { doc, selection } = get();
  return selection.map((id) => doc.bodies.find((b) => b.id === id)).filter((b): b is Body => !!b);
}

/** children roles for an operation: subtract = first is the base, the rest are cut away */
function rolesFor(op: BoolOp, children: Body[], from?: BoolOp): Body[] {
  if (op === "subtract") return children.map((c, i) => ({ ...c, hole: i > 0 }));
  if (op === "intersect" || from === "subtract") return children.map((c) => ({ ...c, hole: false }));
  return children;
}

/**
 * Combines the selection into one body. Nothing is lost: the parts live on inside the result
 * (subtracted tools included) and stay editable in the panel or after "Trennen".
 */
export function combineSelection(op: BoolOp) {
  const doc = get().doc;
  const bodies = orderedSelection();
  if (bodies.length < 2) {
    toast(
      op === "subtract"
        ? "Erst den Körper wählen, von dem abgezogen wird, dann mit Shift+Klick die Teile, die weg sollen"
        : "Wähle mindestens zwei Körper (Shift + Klick)",
    );
    return;
  }
  if (bodies.some(isMeshBody)) {
    toast("Mesh-Körper (große STL/3MF/OBJ) können nicht kombiniert werden – erst im Panel in einen CAD-Körper umwandeln", "error");
    return;
  }
  const children = rolesFor(op, bodies.map((b) => ({ ...b, hidden: false })));
  const base = children.find((c) => !c.hole) ?? children[0];
  const group: Body = {
    id: uid(),
    name: nextName(doc, OP_NAME[op]),
    shape: { kind: "group", children, op },
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    hole: children.every((c) => c.hole),
    color: base.color,
    features: [],
  };
  const firstIdx = Math.min(...bodies.map((b) => doc.bodies.indexOf(b)));
  const rest = doc.bodies.filter((b) => !bodies.includes(b));
  rest.splice(Math.min(firstIdx, rest.length), 0, group);
  commit({ ...doc, bodies: rest });
  set({ selection: [group.id], ...noEdit, groupFocus: null });
  if (op === "subtract")
    toast(`Von „${bodies[0].name}“ abgezogen – die abgezogenen Teile bleiben erhalten und sind im Panel änderbar`);
}

export const groupSelection = () => combineSelection("union");

function groupOf(id: string) {
  const g = getBody(id);
  return g && g.shape.kind === "group" ? (g as Body & { shape: Extract<Shape, { kind: "group" }> }) : null;
}

export function setGroupOp(id: string, op: BoolOp) {
  const g = groupOf(id);
  if (!g) return;
  const from = g.shape.op ?? "union";
  if (from === op) return;
  const children = rolesFor(op, g.shape.children, from);
  const name = g.name.startsWith(OP_NAME[from]) ? OP_NAME[op] + g.name.slice(OP_NAME[from].length) : g.name;
  updateBody(id, { name, shape: { ...g.shape, op, children }, hole: children.every((c) => c.hole) });
}

/** subtract: makes `childId` the body everything else is cut from */
export function setGroupBase(id: string, childId: string) {
  const g = groupOf(id);
  if (!g) return;
  const child = g.shape.children.find((c) => c.id === childId);
  if (!child) return;
  const ordered = [child, ...g.shape.children.filter((c) => c !== child)];
  const children = rolesFor("subtract", ordered);
  updateBody(id, { shape: { ...g.shape, op: "subtract", children }, color: child.color, hole: false });
}

export function updateGroupChild(id: string, childId: string, patch: Partial<Body>) {
  const g = groupOf(id);
  if (!g) return;
  const children = g.shape.children.map((c) => (c.id === childId ? { ...c, ...patch } : c));
  updateBody(id, { shape: { ...g.shape, children }, hole: children.every((c) => c.hole) });
}

/** takes one part out of a combined body (it keeps its place in the world) */
export function extractGroupChild(id: string, childId: string) {
  const doc = get().doc;
  const g = groupOf(id);
  if (!g) return;
  const child = g.shape.children.find((c) => c.id === childId);
  if (!child) return;
  const rest = g.shape.children.filter((c) => c !== child);
  const gq = new THREE.Quaternion(...g.quaternion);
  const p = new THREE.Vector3(...child.position).applyQuaternion(gq).add(new THREE.Vector3(...g.position));
  const out: Body = { ...child, position: [round6(p.x), round6(p.y), round6(p.z)], quaternion: cleanQuat(gq.clone().multiply(new THREE.Quaternion(...child.quaternion))) };
  let bodies: Body[];
  if (rest.length === 1 && !g.features.length) {
    // a combination of one part is just that part
    const only = rest[0];
    const q = new THREE.Vector3(...only.position).applyQuaternion(gq).add(new THREE.Vector3(...g.position));
    const single: Body = { ...only, position: [round6(q.x), round6(q.y), round6(q.z)], quaternion: cleanQuat(gq.clone().multiply(new THREE.Quaternion(...only.quaternion))) };
    bodies = doc.bodies.flatMap((b) => (b.id === id ? [single, out] : [b]));
  } else {
    const children = rolesFor(g.shape.op ?? "union", rest, g.shape.op);
    bodies = doc.bodies.flatMap((b) => (b.id === id ? [{ ...g, shape: { ...g.shape, children } }, out] : [b]));
  }
  commit({ ...doc, bodies });
  set({ selection: [out.id], ...noEdit, groupFocus: null });
}

export function ungroupSelection() {
  const doc = get().doc;
  const groups = selectedBodies().filter((b) => b.shape.kind === "group");
  if (!groups.length) return;
  const newSel: string[] = [];
  let lostFeatures = false;
  const bodies: Body[] = [];
  for (const b of doc.bodies) {
    if (!groups.includes(b) || b.shape.kind !== "group") {
      bodies.push(b);
      continue;
    }
    if (b.features.length) lostFeatures = true;
    const gq = new THREE.Quaternion(...b.quaternion);
    const gp = new THREE.Vector3(...b.position);
    for (const c of b.shape.children) {
      const p = new THREE.Vector3(...c.position).applyQuaternion(gq).add(gp);
      const q = gq.clone().multiply(new THREE.Quaternion(...c.quaternion));
      bodies.push({ ...c, position: [round6(p.x), round6(p.y), round6(p.z)], quaternion: cleanQuat(q) });
      newSel.push(c.id);
    }
  }
  commit({ ...doc, bodies });
  set({ selection: newSel, ...noEdit });
  if (lostFeatures) toast("Rundungen der Gruppe wurden beim Trennen entfernt");
}

/* ------------------------------------------------------------------ */
/* features                                                             */
/* ------------------------------------------------------------------ */

export function addFeature(bodyId: string, f: DistributiveOmit<Feature, "id">) {
  const b = getBody(bodyId);
  if (!b) return;
  updateBody(bodyId, { features: [...b.features, { ...f, id: uid() }] });
}

export function updateFeature(bodyId: string, fid: string, patch: Partial<Feature>) {
  const b = getBody(bodyId);
  if (!b) return;
  updateBody(bodyId, { features: b.features.map((f) => (f.id === fid ? ({ ...f, ...patch } as Feature) : f)) });
}

export function removeFeature(bodyId: string, fid: string) {
  const b = getBody(bodyId);
  if (!b) return;
  updateBody(bodyId, { features: b.features.filter((f) => f.id !== fid) });
}

/* ------------------------------------------------------------------ */
/* document                                                             */
/* ------------------------------------------------------------------ */

export function setSettings(patch: Partial<Settings>) {
  const doc = get().doc;
  commit({ ...doc, settings: { ...doc.settings, ...patch } });
}

export function setUnit(unit: Unit) {
  setSettings({ unit, snap: DEFAULT_SNAP[unit] });
}

export function newDocument(unit: Unit, snap?: number) {
  const s = get();
  const doc = emptyDoc(unit);
  if (snap) doc.settings.snap = snap;
  doc.settings.bed = s.doc.settings.bed;
  set({ doc, past: s.doc.bodies.length ? [...s.past, s.doc] : s.past, future: [], selection: [], ...noEdit, startDialog: false, tool: "select" });
  fitView();
}

export function loadDocument(doc: Doc) {
  const s = get();
  normalizeDoc(doc);
  set({ doc, past: [...s.past, s.doc], future: [], selection: [], ...noEdit, startDialog: false });
  fitView();
}

export function setBodyShape(id: string, shape: Shape, position?: Vec3, features?: Feature[]) {
  const b = getBody(id);
  if (!b) return;
  updateBody(id, { shape, ...(position ? { position } : {}), ...(features ? { features } : {}) });
}

export function alignSelection(axis: 0 | 1 | 2, mode: "min" | "center" | "max") {
  const bodies = selectedBodies();
  if (bodies.length < 2) return;
  const all = unionBox(bodies);
  const target = mode === "min" ? all.min.getComponent(axis) : mode === "max" ? all.max.getComponent(axis) : all.getCenter(new THREE.Vector3()).getComponent(axis);
  const updates: Record<string, Partial<Body>> = {};
  for (const b of bodies) {
    const box = worldBox(b);
    const cur = mode === "min" ? box.min.getComponent(axis) : mode === "max" ? box.max.getComponent(axis) : box.getCenter(new THREE.Vector3()).getComponent(axis);
    const p: Vec3 = [...b.position];
    p[axis] = round6(p[axis] + target - cur);
    updates[b.id] = { position: p };
  }
  updateBodies(updates);
}

/** Example: speaker stand made of two wedges and a connecting bar. */
export function loadSpeakerExample(unit: Unit) {
  const doc = emptyDoc(unit);
  doc.settings.bed = get().doc.settings.bed;
  const mk = (name: string, shape: Shape, position: Vec3, color: string): Body => ({
    id: uid(),
    name,
    shape,
    position,
    quaternion: [0, 0, 0, 1],
    hole: false,
    color,
    features: [],
  });
  const w = 150; // speaker width
  const d = 180; // depth
  const h = 25; // rise at the back (~7.9°)
  doc.bodies = [
    mk("Keil links", { kind: "wedge", w: 20, d, h }, [-w / 2, -d / 2, 0], "#4f8ff7"),
    mk("Keil rechts", { kind: "wedge", w: 20, d, h }, [w / 2 - 20, -d / 2, 0], "#4f8ff7"),
    mk("Steg hinten", { kind: "box", w: w - 40, d: 15, h: 10 }, [-w / 2 + 20, d / 2 - 15, 0], "#f5a524"),
  ];
  const s = get();
  set({ doc, past: s.doc.bodies.length ? [...s.past, s.doc] : s.past, future: [], selection: [], ...noEdit, startDialog: false, tool: "select", view: "iso" });
  fitView();
}

/* ------------------------------------------------------------------ */
/* import                                                               */
/* ------------------------------------------------------------------ */

export const IMPORT_ACCEPT = ".step,.stp,.stl,.3mf,.obj";

/** Imports STEP / STL / 3MF / OBJ files; every solid becomes its own body. */
export async function importFiles(files: File[]) {
  for (const file of files) {
    const format = detectFormat(file.name);
    if (!format) {
      toast(`„${file.name}“: Format nicht unterstützt (STEP, STL, 3MF oder OBJ)`, "error");
      continue;
    }
    const base = file.name.replace(/\.[^.]+$/, "");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const asset: Asset = { name: file.name, format, data: toBase64(bytes) };
      const payload = payloadFromAsset(asset, bytes);
      const triangles = payload.format === "mesh" ? payload.parts.reduce((n, p) => n + p.indices.length / 3, 0) : 0;
      const id = uid();
      // big meshes stay plain meshes: converting them would block the CAD kernel for minutes
      const asMesh = payload.format === "mesh" && triangles > BREP_TRIANGLE_LIMIT;
      let parts: { min: Vec3; max: Vec3 }[];
      if (asMesh && payload.format === "mesh") {
        registerAsset(id, payload);
        parts = payload.parts.map((p) => {
          const b = new THREE.Box3().setFromArray(p.positions);
          return { min: b.min.toArray() as Vec3, max: b.max.toArray() as Vec3 };
        });
      } else {
        toast(
          format === "step"
            ? `Importiere „${file.name}“ …`
            : `Importiere „${file.name}“ – ${triangles.toLocaleString("de-DE")} Dreiecke werden in CAD-Flächen umgewandelt …`,
        );
        parts = await importAsset(id, payload);
      }
      if (!parts.length) throw new Error("keine Volumenkörper gefunden");

      // keep the parts' arrangement, sit them on the bed next to what is already there
      const all = new THREE.Box3();
      for (const p of parts) all.union(new THREE.Box3(new THREE.Vector3(...p.min), new THREE.Vector3(...p.max)));
      const doc = get().doc;
      const size = all.getSize(new THREE.Vector3());
      const existing = unionBox(doc.bodies.filter((b) => !b.hidden));
      const targetMin = existing.isEmpty()
        ? new THREE.Vector3(-size.x / 2, -size.y / 2, 0)
        : new THREE.Vector3(existing.max.x + 10, existing.min.y, 0);
      const offset: Vec3 = [
        round6(targetMin.x - all.min.x),
        round6(targetMin.y - all.min.y),
        round6(-all.min.z),
      ];
      const bodies: Body[] = parts.map((p, i) => ({
        id: uid(),
        name: parts.length > 1 ? `${base} ${i + 1}` : base,
        shape: { kind: "imported", asset: id, part: i, scale: 1, min: p.min, max: p.max, ...(asMesh ? { mode: "mesh" as const } : {}) },
        position: offset,
        quaternion: [0, 0, 0, 1],
        hole: false,
        color: PALETTE[(doc.bodies.length + i) % PALETTE.length],
        features: [],
      }));
      commit({ ...doc, assets: { ...(doc.assets ?? {}), [id]: asset }, bodies: [...doc.bodies, ...bodies] });
      set({ selection: bodies.map((b) => b.id), tool: "select", ...noEdit, startDialog: false });
      fitView();
      const maxDim = Math.max(size.x, size.y, size.z);
      toast(
        `„${file.name}“ importiert – ${parts.length} Körper` +
          (asMesh
            ? ` als Mesh (${triangles.toLocaleString("de-DE")} Dreiecke): verschieben, drehen, exportieren – für Kanten/Flächen/Vereinen mit weniger Auflösung oder als STEP exportieren`
            : "") +
          (maxDim < 2 ? " · sehr klein: evtl. in Metern/Zoll exportiert → Skalierung im Panel anpassen" : ""),
      );
    } catch (err) {
      toast(`„${file.name}“ konnte nicht importiert werden: ${(err as Error).message}`, "error");
    }
  }
}

export const isMeshBody = (b: Body) => b.shape.kind === "imported" && b.shape.mode === "mesh";

/** Converts the mesh bodies of one imported file into CAD solids (slow for big meshes). */
export async function convertMeshAsset(assetId: string) {
  const payload = assetPayload(assetId);
  if (!payload || payload.format !== "mesh") return;
  toast(`Wandle ${triangleCountOf(payload).toLocaleString("de-DE")} Dreiecke in CAD-Flächen um … (unten rechts abbrechbar)`);
  try {
    const parts = await importAsset(assetId, payload);
    const doc = get().doc;
    const old = doc.bodies.filter((b) => b.shape.kind === "imported" && b.shape.asset === assetId && b.shape.mode === "mesh");
    if (!old.length) return;
    const tmpl = old[0];
    const scale = tmpl.shape.kind === "imported" ? tmpl.shape.scale : 1;
    const created: Body[] = parts.map((p, i) => ({
      ...tmpl,
      id: uid(),
      name: parts.length > 1 ? `${tmpl.name} ${i + 1}` : tmpl.name,
      shape: { kind: "imported", asset: assetId, part: i, scale, min: p.min, max: p.max },
    }));
    const firstIdx = doc.bodies.indexOf(tmpl);
    const rest = doc.bodies.filter((b) => !old.includes(b));
    rest.splice(Math.min(firstIdx, rest.length), 0, ...created);
    commit({ ...doc, bodies: rest });
    set({ selection: created.map((b) => b.id) });
    toast("In CAD-Körper umgewandelt – Kanten, Flächen und Vereinen sind jetzt möglich");
  } catch (err) {
    toast(`Umwandlung fehlgeschlagen: ${(err as Error).message}`, "error");
  }
}

const triangleCountOf = (p: { format: string; parts?: { indices: ArrayLike<number> }[] }) =>
  (p.parts ?? []).reduce((n, x) => n + x.indices.length / 3, 0);
