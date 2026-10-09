export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export type Unit = "mm" | "cm" | "in";

/** Parametric shape of a body, in the body's local frame (millimetres). */
export type Shape =
  | { kind: "box"; w: number; d: number; h: number }
  | { kind: "wedge"; w: number; d: number; h: number }
  | { kind: "cylinder"; d: number; h: number }
  | { kind: "cone"; d1: number; d2: number; h: number }
  | { kind: "sphere"; d: number }
  | { kind: "tube"; d: number; t: number; h: number }
  | { kind: "prism"; points: Vec2[]; h: number }
  | { kind: "group"; children: Body[] };

export type ShapeKind = Shape["kind"];

/** Geometric reference to an edge, in the body's local frame. */
export interface EdgeRef {
  mid: Vec3;
  dir: Vec3;
}

export interface EdgeFeature {
  id: string;
  type: "fillet" | "chamfer";
  radius: number;
  edges: EdgeRef[];
}

export interface Body {
  id: string;
  name: string;
  shape: Shape;
  position: Vec3;
  quaternion: Quat;
  hole: boolean;
  color: string;
  features: EdgeFeature[];
  hidden?: boolean;
}

export type SketchShape =
  | { kind: "rect"; x: number; y: number; w: number; d: number }
  | { kind: "circle"; cx: number; cy: number; d: number }
  | { kind: "poly"; points: Vec2[] };

export interface Sketch {
  id: string;
  name: string;
  z: number;
  shape: SketchShape;
}

export interface Settings {
  unit: Unit;
  /** snap step in mm */
  snap: number;
  bed: { x: number; y: number };
}

export interface Doc {
  bodies: Body[];
  sketches: Sketch[];
  settings: Settings;
}

/* ---------- data coming back from the CAD worker ---------- */

export interface EdgeInfo {
  /** offset/count into edgePositions, in vertices (3 floats each) */
  start: number;
  count: number;
  mid: Vec3;
  dir: Vec3;
  len: number;
  /** direction in which a fillet "grows" (into material for convex edges) */
  handleDir: Vec3;
  convex: boolean;
}

export interface FaceInfo {
  /** offset/count into the index buffer */
  start: number;
  count: number;
  /** normal if the face is planar */
  normal: Vec3 | null;
}

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  faces: FaceInfo[];
  edgePositions: Float32Array;
  edges: EdgeInfo[];
  bboxMin: Vec3;
  bboxMax: Vec3;
  warnings: string[];
}

export type ExportFormat = "stl" | "3mf" | "step";
export type ExportQuality = "normal" | "high" | "ultra";
