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
  | { kind: "group"; children: Body[] }
  /** solid `part` of an imported file (see Doc.assets); min/max = its bounds before scaling */
  | {
      kind: "imported";
      asset: string;
      part: number;
      scale: number;
      min: Vec3;
      max: Vec3;
      /** "mesh": large triangle mesh kept as is (move/rotate/export only, no CAD operations) */
      mode?: "mesh";
    };

export type ShapeKind = Shape["kind"];

/** Geometric reference to an edge, in the body's local frame. */
export interface EdgeRef {
  mid: Vec3;
  dir: Vec3;
}

/** Geometric reference to a planar face, in the body's local frame. */
export interface FaceRef {
  center: Vec3;
  normal: Vec3;
}

export type EdgeFeature = { id: string; type: "fillet" | "chamfer"; radius: number; edges: EdgeRef[] };
export type PushFeature = { id: string; type: "push"; face: FaceRef; distance: number };
/** tilts a face around one of its straight edges: positive angle adds a wedge, negative removes one */
export type TiltFeature = { id: string; type: "tilt"; face: FaceRef; hinge: EdgeRef; angle: number };
export type Feature = EdgeFeature | PushFeature | TiltFeature;

export interface Body {
  id: string;
  name: string;
  shape: Shape;
  position: Vec3;
  quaternion: Quat;
  hole: boolean;
  color: string;
  features: Feature[];
  hidden?: boolean;
}

export type SketchShape =
  | { kind: "rect"; x: number; y: number; w: number; d: number }
  | { kind: "circle"; cx: number; cy: number; d: number }
  | { kind: "poly"; points: Vec2[] };

export type PlaneOrient = "top" | "front" | "back" | "right" | "left";

/** sketch plane: orientation (as seen from that view) + world coordinate along its axis */
export interface SketchPlane {
  orient: PlaneOrient;
  value: number;
}

export interface Sketch {
  id: string;
  name: string;
  plane: SketchPlane;
  /** 2D shape in plane coordinates */
  shape: SketchShape;
}

export interface Settings {
  unit: Unit;
  /** snap step in mm */
  snap: number;
  bed: { x: number; y: number };
}

export interface Asset {
  name: string;
  format: "step" | "stl" | "3mf" | "obj";
  /** original file, base64 */
  data: string;
}

export interface Doc {
  bodies: Body[];
  sketches: Sketch[];
  settings: Settings;
  assets?: Record<string, Asset>;
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
  /** straight edge */
  line: boolean;
  /** indices into MeshData.faces of the adjacent faces */
  faces: number[];
}

export interface FaceInfo {
  /** offset/count into the index buffer */
  start: number;
  count: number;
  /** normal and centre if the face is planar */
  normal: Vec3 | null;
  center: Vec3 | null;
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
