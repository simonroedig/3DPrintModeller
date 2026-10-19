/// <reference lib="webworker" />
import opencascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/wasm?url";
import {
  setOC,
  makeBox,
  makeCylinder,
  makeSphere,
  draw,
  measureVolume,
  basicFaceExtrusion,
  makePolygon,
  makeLine,
  makeThreePointArc,
  assembleWire,
  makeFace,
  makeCompound,
  Vector,
  type Shape3D,
  type Edge,
  type Face,
} from "replicad";
import type { Body, EdgeFeature, EdgeInfo, EdgeRef, ExportFormat, ExportQuality, FaceInfo, FaceRef, Feature, MeshData, Shape, Vec3 } from "../types";
import { geometryKey } from "./key";
import { to3MF, toBinarySTL, type ExportPart } from "./formats";
import { meshToSolids, readSTEP } from "./meshToBrep";

/** asset payload as sent to the worker: STEP bytes or already parsed mesh parts */
export type AssetPayload =
  | { format: "step"; bytes: Uint8Array }
  | { format: "mesh"; parts: { positions: Float32Array; indices: Uint32Array }[] };

export interface ImportedPartInfo {
  min: Vec3;
  max: Vec3;
  faces: number;
}

export type WorkerRequest =
  | { type: "asset"; id: string; payload: AssetPayload }
  | { type: "import"; reqId: number; id: string; payload: AssetPayload }
  | { type: "mesh"; reqId: number; key: string; shape: Shape; features: Feature[] }
  | { type: "export"; reqId: number; bodies: Body[]; format: ExportFormat; quality: ExportQuality; separate: boolean }
  | { type: "volume"; reqId: number; bodies: Body[] };

export type WorkerResponse =
  | { type: "ready" }
  | { type: "mesh"; reqId: number; key: string; mesh?: MeshData; error?: string }
  | { type: "export"; reqId: number; data?: Uint8Array; error?: string; volume?: number }
  | { type: "volume"; reqId: number; volume?: number; error?: string }
  | { type: "import"; reqId: number; parts?: ImportedPartInfo[]; error?: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const ready = (async () => {
  const oc = await opencascade({ locateFile: () => wasmUrl } as never);
  setOC(oc);
  ctx.postMessage({ type: "ready" } satisfies WorkerResponse);
})();

/* ------------------------------------------------------------------ */
/* shape cache                                                          */
/* ------------------------------------------------------------------ */

const cache = new Map<string, Shape3D>();
const CACHE_MAX = 80;

function cacheGet(key: string) {
  const s = cache.get(key);
  if (s) {
    cache.delete(key);
    cache.set(key, s);
  }
  return s;
}

function cacheSet(key: string, shape: Shape3D) {
  cache.set(key, shape);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string;
    cache.delete(oldest);
  }
}

/* ------------------------------------------------------------------ */
/* imported files                                                       */
/* ------------------------------------------------------------------ */

const assets = new Map<string, AssetPayload>();
const assetSolids = new Map<string, Shape3D[]>();

/** solids of an imported file, converted on first use and kept for the session */
function importedParts(id: string): Shape3D[] {
  let solids = assetSolids.get(id);
  if (solids) return solids;
  const payload = assets.get(id);
  if (!payload) throw new Error("Imported file is missing");
  if (payload.format === "step") solids = readSTEP(payload.bytes);
  else solids = payload.parts.flatMap((p) => meshToSolids(p.positions, p.indices));
  assetSolids.set(id, solids);
  return solids;
}

/** true if the geometry contains a triangulated (STL/3MF/OBJ) import */
function containsMeshImport(shape: Shape): boolean {
  if (shape.kind === "imported") return assets.get(shape.asset)?.format === "mesh";
  if (shape.kind === "group") return shape.children.some((c) => containsMeshImport(c.shape));
  return false;
}

function partInfo(solid: Shape3D): ImportedPartInfo {
  const [min, max] = solid.boundingBox.bounds as [Vec3, Vec3];
  return { min, max, faces: solid.faces.length };
}

/* ------------------------------------------------------------------ */
/* building                                                             */
/* ------------------------------------------------------------------ */

const EPS = 1e-4;

function buildBase(shape: Shape): Shape3D {
  switch (shape.kind) {
    case "box":
      return makeBox([0, 0, 0], [shape.w, shape.d, shape.h]);
    case "wedge":
      // right-triangle profile in the YZ plane, rising towards +Y, extruded along +X
      return draw([0, 0])
        .lineTo([shape.d, 0])
        .lineTo([shape.d, shape.h])
        .close()
        .sketchOnPlane("YZ")
        .extrude(shape.w) as Shape3D;
    case "cylinder":
      return makeCylinder(shape.d / 2, shape.h, [0, 0, 0], [0, 0, 1]);
    case "cone": {
      const r1 = Math.max(shape.d1 / 2, 0);
      const r2 = Math.max(shape.d2 / 2, 0);
      let pen = draw([0, 0]);
      if (r1 > EPS) pen = pen.lineTo([r1, 0]);
      if (r2 > EPS) pen = pen.lineTo([r2, shape.h]);
      else pen = pen.lineTo([0, shape.h]);
      if (r2 > EPS) pen = pen.lineTo([0, shape.h]);
      return pen.close().sketchOnPlane("XZ").revolve([0, 0, 1]) as Shape3D;
    }
    case "sphere":
      return makeSphere(shape.d / 2).translate(0, 0, shape.d / 2);
    case "tube": {
      const ro = shape.d / 2;
      const ri = Math.max(ro - shape.t, 0.01);
      return draw([ri, 0])
        .lineTo([ro, 0])
        .lineTo([ro, shape.h])
        .lineTo([ri, shape.h])
        .close()
        .sketchOnPlane("XZ")
        .revolve([0, 0, 1]) as Shape3D;
    }
    case "prism": {
      const pts = shape.points;
      let pen = draw(pts[0]);
      for (let i = 1; i < pts.length; i++) pen = pen.lineTo(pts[i]);
      return pen.close().sketchOnPlane("XY").extrude(shape.h) as Shape3D;
    }
    case "imported": {
      if (shape.mode === "mesh") throw new Error("Mesh bodies cannot be edited with CAD operations");
      const solid = importedParts(shape.asset)[shape.part];
      if (!solid) throw new Error("Imported file is missing");
      return shape.scale === 1 ? solid : solid.clone().scale(shape.scale, [0, 0, 0]);
    }
    case "group": {
      const op = shape.op ?? "union";
      const solids: Shape3D[] = [];
      const holes: Shape3D[] = [];
      for (const child of shape.children) {
        const placed = placeBody(child);
        (child.hole ? holes : solids).push(placed);
      }
      if (solids.length === 0) return fuseAll(holes);
      // "subtract" stores its tools as holes, so it builds like a union
      let result =
        op === "intersect" ? commonAll(solids) : op === "group" && solids.length > 1 ? (makeCompound(solids) as Shape3D) : fuseAll(solids);
      if (holes.length) {
        const tool = fuseAll(holes);
        const cut = result.cut(tool);
        result.delete();
        tool.delete();
        result = cut;
      }
      return result;
    }
  }
}

function commonAll(shapes: Shape3D[]): Shape3D {
  let result = shapes[0];
  for (let i = 1; i < shapes.length; i++) {
    const next = result.intersect(shapes[i]);
    result.delete();
    shapes[i].delete();
    result = next;
  }
  if (!result.faces.length) throw new Error("The parts do not overlap, the intersection is empty");
  return result;
}

function fuseAll(shapes: Shape3D[]): Shape3D {
  let result = shapes[0];
  for (let i = 1; i < shapes.length; i++) {
    const next = result.fuse(shapes[i]);
    result.delete();
    shapes[i].delete();
    result = next;
  }
  return result;
}

/** Returns a new (owned) copy of the body's shape placed in its parent frame. */
function placeBody(body: Body): Shape3D {
  const local = getShape(body.shape, body.features).shape.clone();
  return applyTransform(local, body.position, body.quaternion);
}

function applyTransform(shape: Shape3D, p: Vec3, q: [number, number, number, number]): Shape3D {
  let s = shape;
  const [x, y, z, w] = q;
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, w)));
  const sin = Math.sqrt(Math.max(0, 1 - w * w));
  if (angle > 1e-9 && sin > 1e-9) {
    s = s.rotate((angle * 180) / Math.PI, [0, 0, 0], [x / sin, y / sin, z / sin]);
  }
  if (p[0] || p[1] || p[2]) s = s.translate(p[0], p[1], p[2]);
  return s;
}

interface EdgeGeom {
  edge: Edge;
  mid: Vec3;
  dir: Vec3;
  len: number;
}

function edgeGeoms(shape: Shape3D): EdgeGeom[] {
  return shape.edges.map((edge) => {
    const mid = edge.pointAt(0.5).toTuple() as Vec3;
    let dir: Vec3 = [0, 0, 1];
    try {
      dir = edge.tangentAt(0.5).normalized().toTuple() as Vec3;
    } catch {
      /* degenerate */
    }
    return { edge, mid, dir, len: edge.length };
  });
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

function bboxDiag(shape: Shape3D) {
  const [min, max] = shape.boundingBox.bounds as [Vec3, Vec3];
  return len(sub(max, min));
}

class FeatureError extends Error {}

function matchEdge(shape: Shape3D, geoms: EdgeGeom[], ref: EdgeRef): Edge | null {
  const diag = bboxDiag(shape);
  let best: EdgeGeom | null = null;
  let bestScore = Infinity;
  for (const g of geoms) {
    const d = len(sub(g.mid, ref.mid));
    const align = Math.abs(dot(g.dir, ref.dir));
    const score = d + (1 - align) * diag * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return best && bestScore < Math.max(diag * 0.35, 1) ? best.edge : null;
}

function matchFace(shape: Shape3D, ref: FaceRef): Face | null {
  const diag = bboxDiag(shape);
  let best: Face | null = null;
  let bestScore = Infinity;
  for (const f of shape.faces) {
    if (f.geomType !== "PLANE") continue;
    const n = faceNormal(f);
    if (!n || dot(n, ref.normal) < 0.995) continue;
    const c = f.center.toTuple() as Vec3;
    const offset = Math.abs(dot(sub(c, ref.center), ref.normal));
    const score = offset * 4 + len(sub(c, ref.center));
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best && bestScore < Math.max(diag * 0.5, 2) ? best : null;
}

/** Moves a planar face along its normal by adding / removing a prism. */
function pushFace(shape: Shape3D, ref: FaceRef, distance: number): Shape3D {
  const face = matchFace(shape, ref);
  if (!face) throw new FeatureError("face");
  if (Math.abs(distance) < 1e-6) return shape;
  const n = face.normalAt().normalized();
  if (distance > 0) return shape.fuse(basicFaceExtrusion(face, n.multiply(distance)));
  // start the cutting prism slightly outside so it never shares the face exactly
  const lifted = face.clone().translate(n.multiply(0.05).toTuple());
  return shape.cut(basicFaceExtrusion(lifted, n.multiply(distance - 0.05)));
}

/** Tilts a planar face around one of its straight edges by adding (angle > 0) or removing a wedge. */
function tiltFace(shape: Shape3D, ref: FaceRef, hingeRef: EdgeRef, angle: number): Shape3D {
  const face = matchFace(shape, ref);
  if (!face) throw new FeatureError("face");
  const hinge = matchEdge(shape, edgeGeoms(shape), hingeRef);
  if (!hinge || hinge.geomType !== "LINE") throw new FeatureError("hinge");
  if (Math.abs(angle) < 1e-6) return shape;
  const n = face.normalAt().normalized();
  const P0 = hinge.startPoint;
  const e = hinge.endPoint.sub(P0).normalized();
  let u = n.cross(e).normalized();
  if (face.center.sub(P0).dot(u) < 0) u = u.multiply(-1);
  let maxU = 0;
  let minE = Infinity;
  let maxE = -Infinity;
  for (const ed of face.edges) {
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const p = ed.pointAt(k).sub(P0);
      maxU = Math.max(maxU, p.dot(u));
      minE = Math.min(minE, p.dot(e));
      maxE = Math.max(maxE, p.dot(e));
    }
  }
  const w = maxU;
  const t = Math.tan((Math.min(Math.abs(angle), 89) * Math.PI) / 180);
  const m = 0.5;
  const at = (uu: number, nn: number, ee: number) =>
    P0.add(u.multiply(uu)).add(n.multiply(nn)).add(e.multiply(ee)).toTuple() as Vec3;
  const length = maxE - minE + 2 * m;
  if (angle > 0) {
    const tri = makePolygon([at(0, 0, minE - m), at(w, 0, minE - m), at(w, w * t, minE - m)]);
    const prism = basicFaceExtrusion(tri, e.multiply(length));
    const foot = basicFaceExtrusion(face, n.multiply(w * t + m));
    const wedge = prism.intersect(foot);
    return shape.fuse(wedge);
  }
  const top = Math.max(m, m * t) + m;
  const poly = makePolygon([at(-m, m * t, minE - m), at(w + m, -(w + m) * t, minE - m), at(w + m, top, minE - m), at(-m, top, minE - m)]);
  const prism = basicFaceExtrusion(poly, e.multiply(length));
  const lifted = face.clone().translate(n.multiply(top).toTuple());
  const foot = basicFaceExtrusion(lifted, n.multiply(-(top + w * t + m)));
  const wedge = prism.intersect(foot);
  return shape.cut(wedge);
}

/** Direction lying in `face`, perpendicular to the edge, pointing from the edge into the face. */
function inwardDir(shape: Shape3D, face: Face, mid: Vector, e: Vector, n: Vector): Vector | null {
  const m = shape.mesh({ tolerance: 0.1, angularTolerance: 0.5 });
  const g = m.faceGroups.find((fg) => fg.faceId === face.hashCode);
  if (!g) return null;
  const P = m.vertices;
  const T = m.triangles;
  let best: Vector | null = null;
  let bd = Infinity;
  for (let t = g.start; t < g.start + g.count; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const cen = new Vector([(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3]);
    const d = cen.sub(mid).Length;
    if (d < bd) {
      bd = d;
      best = cen;
    }
  }
  if (!best) return null;
  let d = best.sub(mid);
  d = d.sub(e.multiply(d.dot(e)));
  d = d.sub(n.multiply(d.dot(n)));
  return d.Length > 1e-9 ? d.normalized() : null;
}

/**
 * Fallback when OpenCascade's fillet/chamfer fails (typically at joints of merged parts that
 * already had roundings): builds the rounding profile along a straight edge between two planar
 * faces and adds it (concave edge) or cuts it away (convex edge).
 */
function manualBlend(shape: Shape3D, edge: Edge, type: "fillet" | "chamfer", r: number): Shape3D {
  if (edge.geomType !== "LINE") throw new Error("curved edge");
  const adj = shape.faces.filter((f) => f.edges.some((x) => x.isSame(edge)));
  if (adj.length !== 2 || adj.some((f) => f.geomType !== "PLANE")) throw new Error("non-planar faces");
  const P0 = edge.startPoint;
  const P1 = edge.endPoint;
  const e = P1.sub(P0).normalized();
  const mid = edge.pointAt(0.5);
  const n1 = adj[0].normalAt().normalized();
  const n2 = adj[1].normalAt().normalized();
  const t1 = inwardDir(shape, adj[0], mid, e, n1);
  const t2 = inwardDir(shape, adj[1], mid, e, n2);
  if (!t1 || !t2) throw new Error("no direction");
  const convex = t1.dot(n2) < 0;
  const A = Math.acos(Math.max(-1, Math.min(1, t1.dot(t2))));
  if (A < 1e-3 || A > Math.PI - 1e-3) throw new Error("flat edge");
  const margin = 0.5;
  const C = P0.sub(e.multiply(margin));
  const L = P1.sub(P0).Length + 2 * margin;
  const pt = (v: Vector) => v.toTuple() as Vec3;
  let profile: Face;
  if (type === "chamfer") {
    profile = makePolygon([pt(C), pt(C.add(t1.multiply(r))), pt(C.add(t2.multiply(r)))]);
  } else {
    const k = r / Math.tan(A / 2);
    const bis = t1.add(t2).normalized();
    const T1 = C.add(t1.multiply(k));
    const T2 = C.add(t2.multiply(k));
    const M = C.add(bis.multiply(r / Math.sin(A / 2) - r));
    profile = makeFace(assembleWire([makeLine(pt(C), pt(T1)), makeThreePointArc(pt(T1), pt(M), pt(T2)), makeLine(pt(T2), pt(C))]));
  }
  const prism = basicFaceExtrusion(profile, e.multiply(L));
  // keep the profile where both faces actually exist (clean ends)
  const reach = 2 * r + 1;
  const s1 = basicFaceExtrusion(adj[0], n1.multiply(convex ? -reach : reach));
  const s2 = basicFaceExtrusion(adj[1], n2.multiply(convex ? -reach : reach));
  const region = prism.intersect(s1).intersect(s2);
  return convex ? shape.cut(region) : shape.fuse(region);
}

function blendEdges(shape: Shape3D, f: EdgeFeature): Shape3D {
  const geoms = edgeGeoms(shape);
  const selected: Edge[] = [];
  for (const ref of f.edges) {
    const e = matchEdge(shape, geoms, ref);
    if (e) selected.push(e);
  }
  if (!selected.length) throw new FeatureError("edges");
  const occ = (s: Shape3D, edges: Edge[]) => {
    const pick = (e: Edge) => (edges.some((x) => x.isSame(e)) ? f.radius : null);
    return f.type === "fillet" ? s.fillet(pick) : s.chamfer(pick);
  };
  try {
    return occ(shape, selected);
  } catch {
    // one edge at a time, with a constructed rounding where the kernel gives up
    let current = shape;
    for (const ref of f.edges) {
      const edge = matchEdge(current, edgeGeoms(current), ref);
      if (!edge) throw new FeatureError("edges");
      try {
        current = occ(current, [edge]);
      } catch {
        current = manualBlend(current, edge, f.type, f.radius);
      }
    }
    return current;
  }
}

function applyFeature(shape: Shape3D, f: Feature): Shape3D {
  if (f.type === "push") return pushFace(shape, f.face, f.distance);
  if (f.type === "tilt") return tiltFace(shape, f.face, f.hinge, f.angle);
  return blendEdges(shape, f);
}

function featureWarning(f: Feature, err: unknown) {
  const lost = err instanceof FeatureError;
  switch (f.type) {
    case "fillet":
    case "chamfer": {
      const what = f.type === "fillet" ? "Fillet" : "Chamfer";
      return lost ? `${what}: edge no longer found` : `${what} ${round(f.radius)} mm does not fit: radius too large for these edges`;
    }
    case "push":
      return lost ? "Push face: face no longer found" : "Face could not be pushed";
    case "tilt":
      return lost ? "Tilt face: face or hinge edge no longer found" : "Face could not be tilted";
  }
}

const round = (v: number) => Math.round(v * 100) / 100;

interface Built {
  shape: Shape3D;
  warnings: string[];
}

const builtCache = new Map<string, Built>();

function getShape(shape: Shape, features: Feature[]): Built {
  const key = geometryKey({ shape, features });
  const hit = cacheGet(key);
  if (hit) return { shape: hit, warnings: builtCache.get(key)?.warnings ?? [] };

  const baseKey = geometryKey({ shape, features: [] });
  let base = cacheGet(baseKey);
  if (!base) {
    base = buildBase(shape);
    cacheSet(baseKey, base);
  }
  if (!features.length) return { shape: base, warnings: [] };

  // reuse the longest cached prefix of the feature chain
  let current = base;
  let start = 0;
  for (let i = features.length - 1; i > 0; i--) {
    const k = geometryKey({ shape, features: features.slice(0, i) });
    const c = cacheGet(k);
    if (c) {
      current = c;
      start = i;
      break;
    }
  }
  const warnings: string[] = [];
  for (let i = start; i < features.length; i++) {
    const f = features[i];
    try {
      current = applyFeature(current, f);
    } catch (err) {
      warnings.push(featureWarning(f, err));
    }
    cacheSet(geometryKey({ shape, features: features.slice(0, i + 1) }), current);
  }
  builtCache.set(key, { shape: current, warnings });
  if (builtCache.size > CACHE_MAX) builtCache.delete(builtCache.keys().next().value as string);
  return { shape: current, warnings };
}

/* ------------------------------------------------------------------ */
/* meshing                                                              */
/* ------------------------------------------------------------------ */

function meshTolerances(shape: Shape3D, quality: "display" | ExportQuality) {
  const diag = bboxDiag(shape);
  switch (quality) {
    case "display":
      return { tolerance: Math.min(Math.max(diag * 0.0004, 0.01), 0.15), angularTolerance: 0.15 };
    case "normal":
      return { tolerance: 0.02, angularTolerance: 0.1 };
    case "high":
      return { tolerance: 0.008, angularTolerance: 0.05 };
    case "ultra":
      return { tolerance: 0.003, angularTolerance: 0.025 };
  }
}

function faceNormal(face: Face, at?: Vec3): Vec3 | null {
  try {
    return face.normalAt(at).normalized().toTuple() as Vec3;
  } catch {
    return null;
  }
}

function meshShape(shape: Shape3D, warnings: string[], faceted = false): MeshData {
  const tol = meshTolerances(shape, "display");
  const m = shape.mesh(tol);
  const me = shape.meshEdges(tol);

  const faces = shape.faces;
  const faceByHash = new Map<number, number>();
  faces.forEach((f, i) => faceByHash.set(f.hashCode, i));

  const faceInfos: FaceInfo[] = [];
  const faceGroupOf = new Map<number, { start: number; count: number }>();
  const infoIndexOf = new Map<number, number>();
  for (const g of m.faceGroups) {
    const idx = faceByHash.get(g.faceId);
    const face = idx !== undefined ? faces[idx] : undefined;
    let normal: Vec3 | null = null;
    let center: Vec3 | null = null;
    if (face && face.geomType === "PLANE") {
      normal = faceNormal(face);
      center = face.center.toTuple() as Vec3;
    }
    if (idx !== undefined) {
      faceGroupOf.set(idx, { start: g.start, count: g.count });
      infoIndexOf.set(idx, faceInfos.length);
    }
    faceInfos.push({ start: g.start, count: g.count, normal, center });
  }

  // edge -> adjacent faces
  const adj = new Map<number, number[]>();
  const edgeCount: number[] = [];
  faces.forEach((f, fi) => {
    const fe = f.edges;
    edgeCount[fi] = fe.length;
    for (const e of fe) {
      const list = adj.get(e.hashCode) ?? [];
      if (!list.includes(fi)) list.push(fi);
      adj.set(e.hashCode, list);
    }
  });

  const edgesByHash = new Map<number, Edge>();
  for (const e of shape.edges) edgesByHash.set(e.hashCode, e);

  const V = m.vertices;
  const T = m.triangles;
  const nearestCentroid = (fi: number, p: Vec3): Vec3 | null => {
    const g = faceGroupOf.get(fi);
    if (!g) return null;
    let best: Vec3 | null = null;
    let bd = Infinity;
    for (let t = g.start; t < g.start + g.count; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      const cen: Vec3 = [(V[a] + V[b] + V[c]) / 3, (V[a + 1] + V[b + 1] + V[c + 1]) / 3, (V[a + 2] + V[b + 2] + V[c + 2]) / 3];
      const d = len(sub(cen, p));
      if (d < bd) {
        bd = d;
        best = cen;
      }
    }
    return best;
  };

  const edgeInfos: EdgeInfo[] = [];
  const edgeLines: number[] = [];
  for (const g of me.edgeGroups) {
    const edge = edgesByHash.get(g.edgeId);
    const adjFaces = adj.get(g.edgeId) ?? [];
    if (!edge || adjFaces.length < 2) continue; // seam or free edge
    const mid = edge.pointAt(0.5).toTuple() as Vec3;
    let dir: Vec3 = [0, 0, 1];
    try {
      dir = edge.tangentAt(0.5).normalized().toTuple() as Vec3;
    } catch {
      /* ignore */
    }
    const n1 = faceNormal(faces[adjFaces[0]], mid);
    const n2 = faceNormal(faces[adjFaces[1]], mid);
    if (!n1 || !n2) continue;
    const sum: Vec3 = [n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]];
    const sl = len(sum);
    const smooth = dot(n1, n2) > 0.996;
    // facets of an imported mesh (planar pieces meeting at a shallow angle) are neither drawn nor pickable
    const facet =
      dot(n1, n2) > (faceted ? 0.75 : 0.866) &&
      (faceted || edgeCount[adjFaces[0]] === 3 || edgeCount[adjFaces[1]] === 3) &&
      faces[adjFaces[0]].geomType === "PLANE" &&
      faces[adjFaces[1]].geomType === "PLANE";
    if (facet) continue;
    const startVert = edgeLines.length / 3;
    for (let k = g.start * 3; k < (g.start + g.count) * 3; k++) edgeLines.push(me.lines[k]);
    const line = edge.geomType === "LINE";
    const faceIdx = adjFaces.map((fi) => infoIndexOf.get(fi) ?? -1);
    if (smooth || sl < 1e-6) {
      // tangent edge: displayed but not offered for filleting
      edgeInfos.push({ start: startVert, count: g.count, mid, dir, len: -1, handleDir: [0, 0, 1], convex: true, line, faces: faceIdx });
      continue;
    }
    const c1 = nearestCentroid(adjFaces[0], mid);
    const convex = c1 ? dot(sub(c1, mid), n2) < 0 : true;
    const s = convex ? -1 / sl : 1 / sl;
    edgeInfos.push({
      start: startVert,
      count: g.count,
      mid,
      dir,
      len: edge.length,
      handleDir: [sum[0] * s, sum[1] * s, sum[2] * s],
      convex,
      line,
      faces: faceIdx,
    });
  }

  const [bmin, bmax] = shape.boundingBox.bounds as [Vec3, Vec3];
  // tighter bbox from the mesh itself (OCC boxes are padded)
  const mn: Vec3 = [Infinity, Infinity, Infinity];
  const mx: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < V.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (V[i + a] < mn[a]) mn[a] = V[i + a];
      if (V[i + a] > mx[a]) mx[a] = V[i + a];
    }
  }
  return {
    positions: new Float32Array(V),
    normals: new Float32Array(m.normals),
    indices: new Uint32Array(T),
    faces: faceInfos,
    edgePositions: new Float32Array(edgeLines),
    edges: edgeInfos,
    bboxMin: V.length ? mn : bmin,
    bboxMax: V.length ? mx : bmax,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* export                                                               */
/* ------------------------------------------------------------------ */

function combine(bodies: Body[]): Shape3D | null {
  const solids: Shape3D[] = [];
  const holes: Shape3D[] = [];
  for (const b of bodies) {
    if (b.hidden) continue;
    (b.hole ? holes : solids).push(placeBody(b));
  }
  if (!solids.length) {
    holes.forEach((h) => h.delete());
    return null;
  }
  let result = fuseAll(solids);
  if (holes.length) {
    const tool = fuseAll(holes);
    const cut = result.cut(tool);
    result.delete();
    tool.delete();
    result = cut;
  }
  return result;
}

const isMeshBody = (b: Body) => b.shape.kind === "imported" && b.shape.mode === "mesh";

/** triangles of a mesh body in world coordinates */
function meshBodyTriangles(b: Body): ExportPart | null {
  if (b.shape.kind !== "imported") return null;
  const payload = assets.get(b.shape.asset);
  const part = payload?.format === "mesh" ? payload.parts[b.shape.part] : undefined;
  if (!part) return null;
  const k = b.shape.scale;
  const [qx, qy, qz, qw] = b.quaternion;
  const [px, py, pz] = b.position;
  const src = part.positions;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i] * k, y = src[i + 1] * k, z = src[i + 2] * k;
    // v' = q v q*
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    out[i] = ix * qw + iw * -qx + iy * -qz - iz * -qy + px;
    out[i + 1] = iy * qw + iw * -qy + iz * -qx - ix * -qz + py;
    out[i + 2] = iz * qw + iw * -qz + ix * -qy - iy * -qx + pz;
  }
  return { name: b.name, positions: out, indices: part.indices };
}

function meshVolume(p: ExportPart) {
  let v = 0;
  const P = p.positions, I = p.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  return Math.abs(v);
}

async function exportBodies(allBodies: Body[], format: ExportFormat, quality: ExportQuality, separate: boolean) {
  const meshParts = allBodies.filter((b) => !b.hidden && isMeshBody(b)).map(meshBodyTriangles).filter((p): p is ExportPart => !!p);
  const bodies = allBodies.filter((b) => !isMeshBody(b));
  if (format === "step") {
    const shape = combine(bodies);
    if (!shape) throw new Error(meshParts.length ? "Mesh bodies (large STL/3MF/OBJ) cannot be exported as STEP" : "Nothing to export");
    const blob = shape.blobSTEP();
    const volume = measureVolume(shape);
    shape.delete();
    return { data: new Uint8Array(await blob.arrayBuffer()), volume };
  }
  const groups: { name: string; bodies: Body[] }[] = [];
  if (separate) {
    const holes = bodies.filter((b) => b.hole && !b.hidden);
    for (const b of bodies) if (!b.hole && !b.hidden) groups.push({ name: b.name, bodies: [b, ...holes] });
  } else {
    groups.push({ name: "Model", bodies });
  }
  const parts: ExportPart[] = [];
  let volume = 0;
  for (const g of groups) {
    const shape = combine(g.bodies);
    if (!shape) continue;
    const m = shape.mesh(meshTolerances(shape, quality));
    volume += measureVolume(shape);
    parts.push({ name: g.name, positions: m.vertices, indices: m.triangles });
    shape.delete();
  }
  for (const p of meshParts) {
    parts.push(p);
    volume += meshVolume(p);
  }
  if (!parts.length) throw new Error("Nothing to export");
  return { data: format === "stl" ? toBinarySTL(parts) : to3MF(parts, !separate), volume };
}

/* ------------------------------------------------------------------ */

// messages are handled strictly one after another (asset registrations must precede meshing)
let queue: Promise<void> = ready;
ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  queue = queue.then(() => handle(ev.data)).catch((err) => console.error(err));
};

async function handle(msg: WorkerRequest) {
  if (msg.type === "asset") {
    assets.set(msg.id, msg.payload);
    return;
  }
  if (msg.type === "import") {
    try {
      assets.set(msg.id, msg.payload);
      assetSolids.delete(msg.id);
      const parts = importedParts(msg.id).map(partInfo);
      ctx.postMessage({ type: "import", reqId: msg.reqId, parts } satisfies WorkerResponse);
    } catch (err) {
      assets.delete(msg.id);
      ctx.postMessage({ type: "import", reqId: msg.reqId, error: String((err as Error)?.message ?? err) } satisfies WorkerResponse);
    }
    return;
  }
  if (msg.type === "mesh") {
    try {
      const built = getShape(msg.shape, msg.features);
      const mesh = meshShape(built.shape, built.warnings, containsMeshImport(msg.shape));
      ctx.postMessage({ type: "mesh", reqId: msg.reqId, key: msg.key, mesh } satisfies WorkerResponse, [
        mesh.positions.buffer,
        mesh.normals.buffer,
        mesh.indices.buffer,
        mesh.edgePositions.buffer,
      ]);
    } catch (err) {
      ctx.postMessage({ type: "mesh", reqId: msg.reqId, key: msg.key, error: String((err as Error)?.message ?? err) } satisfies WorkerResponse);
    }
  } else if (msg.type === "export") {
    try {
      const { data, volume } = await exportBodies(msg.bodies, msg.format, msg.quality, msg.separate);
      ctx.postMessage({ type: "export", reqId: msg.reqId, data, volume } satisfies WorkerResponse, [data.buffer]);
    } catch (err) {
      ctx.postMessage({ type: "export", reqId: msg.reqId, error: String((err as Error)?.message ?? err) } satisfies WorkerResponse);
    }
  } else if (msg.type === "volume") {
    try {
      const shape = combine(msg.bodies);
      const volume = shape ? measureVolume(shape) : 0;
      shape?.delete();
      ctx.postMessage({ type: "volume", reqId: msg.reqId, volume } satisfies WorkerResponse);
    } catch (err) {
      ctx.postMessage({ type: "volume", reqId: msg.reqId, error: String((err as Error)?.message ?? err) } satisfies WorkerResponse);
    }
  }
}
