import { create } from "zustand";
import * as THREE from "three";
import type { Body, Doc, EdgeFeature, EdgeRef, Quat, Settings, Shape, ShapeKind, Sketch, SketchShape, Unit, Vec2, Vec3 } from "../types";
import { DEFAULT_SNAP } from "../lib/units";
import { cleanQuat, localBox, polyBounds, polygonArea, quatFromEulerDeg, unionBox, worldBox } from "../lib/geom";

export type Tool = "select" | "rect" | "circle" | "poly" | "fillet" | "layflat";
export type View = "iso" | "top" | "front" | "right";

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

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

interface State {
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
  guides: Guide[];
  dragInfo: string | null;
  startDialog: boolean;
  exportOpen: boolean;
  helpOpen: boolean;
  toasts: Toast[];
  sketchZ: number;
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
    d.sketches ??= [];
    return d;
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
  edgeSel: null,
  fillet: { type: "fillet", radius: 2 },
  guides: [],
  dragInfo: null,
  startDialog: !initialDoc,
  exportOpen: false,
  helpOpen: false,
  toasts: [],
  sketchZ: 0,
}));

const get = useStore.getState;
const set = useStore.setState;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.doc === prev.doc) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().doc));
    } catch {
      /* quota */
    }
  }, 400);
});

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

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
  set({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], edgeSel: null });
  pruneSelection();
}

export function redo() {
  const s = get();
  if (s.txBase || !s.future.length) return;
  const [next, ...rest] = s.future;
  set({ doc: next, past: [...s.past, s.doc], future: rest, edgeSel: null });
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
  set({ selection: ids, edgeSel: null });
}

export function setTool(tool: Tool) {
  const s = get();
  const patch: Partial<State> = { tool, edgeSel: null };
  const sketching = (t: Tool) => t === "rect" || t === "circle" || t === "poly";
  // sketches live on the XY plane: look at it from the top when starting to sketch
  if (sketching(tool) && !sketching(s.tool) && s.view !== "top") {
    patch.view = "top";
    patch.fitNonce = s.fitNonce + 1;
  }
  set(patch);
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

export function defaultShape(kind: Exclude<ShapeKind, "group" | "prism">): Shape {
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

export function addPrimitive(kind: Exclude<ShapeKind, "group" | "prism">, hole = false) {
  const doc = get().doc;
  const shape = defaultShape(kind);
  const body = makeBody(doc, shape, { hole });
  if (hole) body.name = `Loch ${body.name}`;
  body.position = placeNewBody(doc, shape);
  commit({ ...doc, bodies: [...doc.bodies, body] });
  set({ selection: [body.id], tool: "select", edgeSel: null });
}

export function addSketch(shape: SketchShape) {
  const doc = get().doc;
  const sketch: Sketch = { id: uid(), name: nextName(doc, "Skizze"), z: get().sketchZ, shape };
  commit({ ...doc, sketches: [...doc.sketches, sketch] });
  set({ selection: [sketch.id], edgeSel: null });
}

export function updateSketch(id: string, shape: SketchShape, z?: number) {
  const doc = get().doc;
  commit({ ...doc, sketches: doc.sketches.map((s) => (s.id === id ? { ...s, shape, z: z ?? s.z } : s)) });
}

export function sketchToBody(doc: Doc, sketch: Sketch, height: number, hole: boolean): Body | null {
  let h = height;
  let z = sketch.z;
  if (h < 0) {
    z += h;
    h = -h;
  }
  if (h < 1e-3) return null;
  const s = sketch.shape;
  let shape: Shape;
  let position: Vec3;
  if (s.kind === "rect") {
    if (s.w < 1e-3 || s.d < 1e-3) return null;
    shape = { kind: "box", w: s.w, d: s.d, h };
    position = [s.x, s.y, z];
  } else if (s.kind === "circle") {
    if (s.d < 1e-3) return null;
    shape = { kind: "cylinder", d: s.d, h };
    position = [s.cx, s.cy, z];
  } else {
    let pts = s.points;
    if (pts.length < 3) return null;
    if (polygonArea(pts) < 0) pts = [...pts].reverse();
    const pb = polyBounds(pts);
    shape = { kind: "prism", h, points: pts.map(([x, y]) => [x - pb.minX, y - pb.minY] as Vec2) };
    position = [pb.minX, pb.minY, z];
  }
  const body = makeBody(doc, shape, { position, hole });
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
  set({ selection: [], edgeSel: null });
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
  set({ selection: copies.map((c) => c.id), edgeSel: null });
}

export function groupSelection() {
  const doc = get().doc;
  const bodies = selectedBodies();
  if (bodies.length < 2) {
    toast("Wähle mindestens zwei Körper (Shift + Klick) zum Vereinen");
    return;
  }
  const solids = bodies.filter((b) => !b.hole);
  const group: Body = {
    id: uid(),
    name: nextName(doc, "Gruppe"),
    shape: { kind: "group", children: bodies.map((b) => ({ ...b, hidden: false })) },
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    hole: solids.length === 0,
    color: (solids[0] ?? bodies[0]).color,
    features: [],
  };
  const firstIdx = doc.bodies.findIndex((b) => b.id === bodies[0].id);
  const rest = doc.bodies.filter((b) => !bodies.includes(b));
  rest.splice(Math.min(firstIdx, rest.length), 0, group);
  commit({ ...doc, bodies: rest });
  set({ selection: [group.id], edgeSel: null });
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
  set({ selection: newSel, edgeSel: null });
  if (lostFeatures) toast("Rundungen der Gruppe wurden beim Trennen entfernt");
}

/* ------------------------------------------------------------------ */
/* features                                                             */
/* ------------------------------------------------------------------ */

export function addFeature(bodyId: string, f: Omit<EdgeFeature, "id">) {
  const b = getBody(bodyId);
  if (!b) return;
  updateBody(bodyId, { features: [...b.features, { ...f, id: uid() }] });
}

export function updateFeature(bodyId: string, fid: string, patch: Partial<EdgeFeature>) {
  const b = getBody(bodyId);
  if (!b) return;
  updateBody(bodyId, { features: b.features.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });
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
  set({ doc, past: s.doc.bodies.length ? [...s.past, s.doc] : s.past, future: [], selection: [], edgeSel: null, startDialog: false, tool: "select" });
  fitView();
}

export function loadDocument(doc: Doc) {
  const s = get();
  doc.sketches ??= [];
  set({ doc, past: [...s.past, s.doc], future: [], selection: [], edgeSel: null, startDialog: false });
  fitView();
}

export function setBodyShape(id: string, shape: Shape, position?: Vec3) {
  const b = getBody(id);
  if (!b) return;
  updateBody(id, position ? { shape, position } : { shape });
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

export function applyFillet() {
  const { edgeSel, fillet } = get();
  if (!edgeSel || !edgeSel.refs.length || fillet.radius <= 0) return;
  addFeature(edgeSel.bodyId, { type: fillet.type, radius: fillet.radius, edges: edgeSel.refs });
  set({ edgeSel: null });
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
  set({ doc, past: s.doc.bodies.length ? [...s.past, s.doc] : s.past, future: [], selection: [], edgeSel: null, startDialog: false, tool: "select", view: "iso" });
  fitView();
}
