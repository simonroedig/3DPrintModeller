import { strFromU8, unzipSync } from "fflate";
import type { Asset } from "../types";
import type { AssetPayload } from "./worker";

export type ImportFormat = "step" | "stl" | "3mf" | "obj";

export interface MeshPart {
  name: string;
  positions: Float32Array;
  indices: Uint32Array;
}

export function detectFormat(fileName: string): ImportFormat | null {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "step" || ext === "stp") return "step";
  if (ext === "stl") return "stl";
  if (ext === "3mf") return "3mf";
  if (ext === "obj") return "obj";
  return null;
}

/* ---------------- base64 (assets are stored inside the document) ---------------- */

export function toBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function fromBase64(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ---------------- STL ---------------- */

function isBinarySTL(bytes: Uint8Array) {
  if (bytes.length < 84) return false;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(80, true);
  if (84 + n * 50 === bytes.length) return true;
  // ascii files start with "solid", but some binary exporters write that too, so only trust the size check
  const head = strFromU8(bytes.subarray(0, Math.min(bytes.length, 512)));
  return !/^\s*solid[\s\S]*facet/.test(head);
}

function parseSTL(bytes: Uint8Array, name: string): MeshPart[] {
  const positions: number[] = [];
  if (isBinarySTL(bytes)) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = dv.getUint32(80, true);
    for (let t = 0; t < n; t++) {
      const o = 84 + t * 50 + 12;
      for (let k = 0; k < 9; k++) positions.push(dv.getFloat32(o + k * 4, true));
    }
  } else {
    const text = strFromU8(bytes);
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) positions.push(+m[1], +m[2], +m[3]);
  }
  const indices = new Uint32Array(positions.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return [{ name, positions: new Float32Array(positions), indices }];
}

/* ---------------- OBJ ---------------- */

function parseOBJ(bytes: Uint8Array, name: string): MeshPart[] {
  const text = strFromU8(bytes);
  const verts: number[] = [];
  const parts: { name: string; idx: number[] }[] = [{ name, idx: [] }];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.split(/\s+/);
      verts.push(+x, +y, +z);
    } else if (line.startsWith("o ") || line.startsWith("g ")) {
      const cur = parts[parts.length - 1];
      const label = line.slice(2).trim() || name;
      if (cur.idx.length) parts.push({ name: label, idx: [] });
      else cur.name = label;
    } else if (line.startsWith("f ")) {
      const ids = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((tok) => {
          const i = parseInt(tok.split("/")[0], 10);
          return i < 0 ? verts.length / 3 + i : i - 1;
        });
      for (let k = 1; k + 1 < ids.length; k++) parts[parts.length - 1].idx.push(ids[0], ids[k], ids[k + 1]);
    }
  }
  return parts
    .filter((p) => p.idx.length)
    .map((p) => ({ name: p.name, positions: new Float32Array(verts), indices: new Uint32Array(p.idx) }));
}

/* ---------------- 3MF ---------------- */

type Mat = number[]; // 3x4 row-major as in 3MF ("m00 m01 m02 m10 ... m32")
const IDENTITY: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

function parseTransform(s: string | null): Mat {
  if (!s) return IDENTITY;
  const v = s.trim().split(/\s+/).map(Number);
  return v.length === 12 ? v : IDENTITY;
}

// 3MF uses row vectors: p' = p * M
function mul(a: Mat, b: Mat): Mat {
  const r = (i: number, j: number, m: Mat) => m[i * 3 + j];
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += r(i, k, a) * r(k, j, b);
      if (i === 3) v += r(3, j, b);
      out.push(v);
    }
  }
  return out;
}

const UNIT_SCALE: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

function parse3MF(bytes: Uint8Array, name: string): MeshPart[] {
  const files = unzipSync(bytes);
  const models = new Map<string, Document>();
  for (const [path, data] of Object.entries(files)) {
    if (path.toLowerCase().endsWith(".model")) models.set("/" + path.replace(/^\//, ""), new DOMParser().parseFromString(strFromU8(data), "application/xml"));
  }
  const rootPath = [...models.keys()].find((p) => /3dmodel\.model$/i.test(p)) ?? [...models.keys()][0];
  if (!rootPath) throw new Error("No 3D data in the 3MF file");
  const root = models.get(rootPath)!;
  const unit = UNIT_SCALE[root.documentElement.getAttribute("unit") ?? "millimeter"] ?? 1;
  const local = (el: Element) => Array.from(el.children);
  const byTag = (el: Element | Document, tag: string) => Array.from(el.getElementsByTagNameNS("*", tag));

  const findObject = (path: string, id: string) =>
    byTag(models.get(path) ?? root, "object").find((o) => o.getAttribute("id") === id) ?? null;

  const collect = (path: string, obj: Element, m: Mat, out: { positions: number[]; indices: number[] }, depth = 0) => {
    if (depth > 16) return;
    const mesh = local(obj).find((c) => c.localName === "mesh");
    if (mesh) {
      const base = out.positions.length / 3;
      for (const v of byTag(mesh, "vertex")) {
        const x = +v.getAttribute("x")!, y = +v.getAttribute("y")!, z = +v.getAttribute("z")!;
        out.positions.push(
          (x * m[0] + y * m[3] + z * m[6] + m[9]) * unit,
          (x * m[1] + y * m[4] + z * m[7] + m[10]) * unit,
          (x * m[2] + y * m[5] + z * m[8] + m[11]) * unit,
        );
      }
      for (const t of byTag(mesh, "triangle")) {
        out.indices.push(base + +t.getAttribute("v1")!, base + +t.getAttribute("v2")!, base + +t.getAttribute("v3")!);
      }
    }
    for (const comp of byTag(obj, "component")) {
      const p = comp.getAttribute("p:path") ?? comp.getAttributeNS("*", "path") ?? path;
      const child = findObject(p.startsWith("/") ? p : "/" + p, comp.getAttribute("objectid")!) ?? findObject(path, comp.getAttribute("objectid")!);
      if (child) collect(p, child, mul(parseTransform(comp.getAttribute("transform")), m), out, depth + 1);
    }
  };

  const parts: MeshPart[] = [];
  const items = byTag(root, "item");
  items.forEach((item, i) => {
    const obj = findObject(rootPath, item.getAttribute("objectid")!);
    if (!obj) return;
    const out = { positions: [] as number[], indices: [] as number[] };
    collect(rootPath, obj, parseTransform(item.getAttribute("transform")), out);
    if (!out.indices.length) return;
    const label = obj.getAttribute("name") || (items.length > 1 ? `${name} ${i + 1}` : name);
    parts.push({ name: label, positions: new Float32Array(out.positions), indices: new Uint32Array(out.indices) });
  });
  return parts;
}

export function parseMeshFile(format: Exclude<ImportFormat, "step">, bytes: Uint8Array, name: string): MeshPart[] {
  const parts = format === "stl" ? parseSTL(bytes, name) : format === "obj" ? parseOBJ(bytes, name) : parse3MF(bytes, name);
  if (!parts.length) throw new Error("The file contains no triangles");
  return parts;
}

/** Turns a stored asset into what the CAD worker needs (STEP bytes or parsed triangles). */
export function payloadFromAsset(asset: Asset, bytes: Uint8Array = fromBase64(asset.data)): AssetPayload {
  if (asset.format === "step") return { format: "step", bytes };
  const parts = parseMeshFile(asset.format, bytes, asset.name);
  return { format: "mesh", parts: parts.map((p) => ({ positions: p.positions, indices: p.indices })) };
}
