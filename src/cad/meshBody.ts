import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FaceInfo, MeshData, Vec3 } from "../types";
import { planarRegions } from "./regions";

/**
 * Display data for a large imported mesh that is kept as a plain triangle mesh (no CAD
 * conversion). Coplanar triangles are grouped into faces so "lay flat" still works.
 */
export function meshBodyData(part: { positions: ArrayLike<number>; indices: ArrayLike<number> }, scale: number): MeshData {
  const { P, I, N, regions } = planarRegions(part.positions, part.indices);
  const order: number[] = [];
  const faces: FaceInfo[] = [];
  for (const list of regions) {
    const start = order.length;
    let cx = 0, cy = 0, cz = 0, area = 0;
    for (const t of list) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      order.push(a, b, c);
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const w = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      area += w;
      cx += (w * (P[a * 3] + P[b * 3] + P[c * 3])) / 3;
      cy += (w * (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1])) / 3;
      cz += (w * (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2])) / 3;
    }
    const t0 = list[0];
    const center: Vec3 = area > 0 ? [(cx / area) * scale, (cy / area) * scale, (cz / area) * scale] : [0, 0, 0];
    faces.push({ start, count: list.length * 3, normal: [N[t0 * 3], N[t0 * 3 + 1], N[t0 * 3 + 2]], center });
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(P.map((v) => v * scale), 3));
  indexed.setIndex(order);
  // smooth shading on curved areas, crisp edges where the surface really bends
  const creased = toCreasedNormals(indexed, THREE.MathUtils.degToRad(30));
  const edgesGeo = new THREE.EdgesGeometry(indexed, 35);
  creased.computeBoundingBox();
  const bb = creased.boundingBox!;
  const positions = creased.getAttribute("position").array as Float32Array;
  const normals = creased.getAttribute("normal").array as Float32Array;
  const indices = new Uint32Array(positions.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i; // triangle order (and face ranges) is preserved
  const data: MeshData = {
    positions,
    normals,
    indices,
    faces,
    edgePositions: edgesGeo.getAttribute("position").array as Float32Array,
    edges: [],
    bboxMin: bb.min.toArray() as Vec3,
    bboxMax: bb.max.toArray() as Vec3,
    warnings: [],
  };
  indexed.dispose();
  edgesGeo.dispose();
  return data;
}
