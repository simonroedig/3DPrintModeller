import { weld } from "./formats";

/** Welded triangle mesh split into connected groups of coplanar triangles. */
export interface PlanarRegions {
  P: number[];
  I: number[];
  /** unit normal per triangle (0 for degenerate ones) */
  N: Float64Array;
  /** triangles per region (degenerate triangles are left out) */
  regions: number[][];
}

export function planarRegions(positions: ArrayLike<number>, indices: ArrayLike<number>): PlanarRegions {
  const { positions: P, indices: I } = weld(positions, indices);
  const nT = I.length / 3;
  const nV = P.length / 3;
  const N = new Float64Array(nT * 3);
  const D = new Float64Array(nT);
  const ok = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) continue;
    ok[t] = 1;
    nx /= l; ny /= l; nz /= l;
    N[t * 3] = nx; N[t * 3 + 1] = ny; N[t * 3 + 2] = nz;
    D[t] = nx * P[a] + ny * P[a + 1] + nz * P[a + 2];
  }

  const ekey = (a: number, b: number) => (a < b ? a * nV + b : b * nV + a);
  const edgeTris = new Map<number, number[]>();
  for (let t = 0; t < nT; t++) {
    if (!ok[t]) continue;
    for (let k = 0; k < 3; k++) {
      const key = ekey(I[t * 3 + k], I[t * 3 + ((k + 1) % 3)]);
      const list = edgeTris.get(key);
      if (list) list.push(t);
      else edgeTris.set(key, [t]);
    }
  }

  const region = new Int32Array(nT).fill(-1);
  const regions: number[][] = [];
  for (let t = 0; t < nT; t++) {
    if (!ok[t] || region[t] >= 0) continue;
    const r = regions.length;
    const list = [t];
    region[t] = r;
    for (let qi = 0; qi < list.length; qi++) {
      const s = list[qi];
      for (let k = 0; k < 3; k++) {
        for (const u of edgeTris.get(ekey(I[s * 3 + k], I[s * 3 + ((k + 1) % 3)])) ?? []) {
          if (region[u] >= 0) continue;
          const dot = N[s * 3] * N[u * 3] + N[s * 3 + 1] * N[u * 3 + 1] + N[s * 3 + 2] * N[u * 3 + 2];
          if (dot > 0.99999 && Math.abs(D[s] - D[u]) < 5e-3) {
            region[u] = r;
            list.push(u);
          }
        }
      }
    }
    regions.push(list);
  }
  return { P, I, N, regions };
}

export function triangleCount(parts: { indices: ArrayLike<number> }[]) {
  return parts.reduce((n, p) => n + p.indices.length / 3, 0);
}

/** Above this size meshes are kept as lightweight mesh bodies instead of being converted to CAD solids. */
export const BREP_TRIANGLE_LIMIT = 12_000;
