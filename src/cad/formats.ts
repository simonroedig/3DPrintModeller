import { zipSync, strToU8 } from "fflate";

export interface ExportPart {
  name: string;
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
}

/** Merges coincident vertices so the mesh becomes watertight/indexed. */
export function weld(positions: ArrayLike<number>, indices: ArrayLike<number>) {
  const map = new Map<string, number>();
  const outPos: number[] = [];
  const remap = new Uint32Array(positions.length / 3);
  const q = 1e5;
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = outPos.length / 3;
      map.set(key, idx);
      outPos.push(x, y, z);
    }
    remap[i] = idx;
  }
  const outIdx: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]];
    const b = remap[indices[t + 1]];
    const c = remap[indices[t + 2]];
    if (a === b || b === c || a === c) continue; // degenerate
    outIdx.push(a, b, c);
  }
  return { positions: outPos, indices: outIdx };
}

export function toBinarySTL(parts: ExportPart[]): Uint8Array {
  let triCount = 0;
  for (const p of parts) triCount += p.indices.length / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const header = "3DPrintModeller binary STL (mm)";
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (const p of parts) {
    const P = p.positions;
    const I = p.indices;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3;
      const b = I[t + 1] * 3;
      const c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
      o += 12;
      for (const v of [a, b, c]) {
        dv.setFloat32(o, P[v], true);
        dv.setFloat32(o + 4, P[v + 1], true);
        dv.setFloat32(o + 8, P[v + 2], true);
        o += 12;
      }
      dv.setUint16(o, 0, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

function xmlEscape(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

const fmt = (v: number) => {
  const r = Math.round(v * 1e5) / 1e5;
  return Object.is(r, -0) ? "0" : String(r);
};

/** @param together several parts become one object made of components (slicers keep them as one) */
export function to3MF(parts: ExportPart[], together = false): Uint8Array {
  const objects: string[] = [];
  const items: string[] = [];
  parts.forEach((part, i) => {
    const { positions, indices } = weld(part.positions, part.indices);
    const id = i + 1;
    const v: string[] = [];
    for (let k = 0; k < positions.length; k += 3) {
      v.push(`<vertex x="${fmt(positions[k])}" y="${fmt(positions[k + 1])}" z="${fmt(positions[k + 2])}"/>`);
    }
    const t: string[] = [];
    for (let k = 0; k < indices.length; k += 3) {
      t.push(`<triangle v1="${indices[k]}" v2="${indices[k + 1]}" v3="${indices[k + 2]}"/>`);
    }
    objects.push(
      `<object id="${id}" type="model" name="${xmlEscape(part.name)}"><mesh><vertices>${v.join("")}</vertices><triangles>${t.join("")}</triangles></mesh></object>`,
    );
    items.push(`<item objectid="${id}"/>`);
  });
  if (together && parts.length > 1) {
    const id = parts.length + 1;
    const comps = parts.map((_, i) => `<component objectid="${i + 1}"/>`).join("");
    objects.push(`<object id="${id}" type="model" name="Model"><components>${comps}</components></object>`);
    items.length = 0;
    items.push(`<item objectid="${id}"/>`);
  }
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<metadata name="Application">3DPrintModeller</metadata>` +
    `<resources>${objects.join("")}</resources><build>${items.join("")}</build></model>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;
  return zipSync(
    {
      "[Content_Types].xml": strToU8(contentTypes),
      "_rels/.rels": strToU8(rels),
      "3D/3dmodel.model": strToU8(model),
    },
    { level: 6 },
  );
}
