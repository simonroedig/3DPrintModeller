import { assembleWire, cast, getOC, makeFace, makeLine, makePolygon, type Shape3D } from "replicad";
import type { Vec3 } from "../types";
import { planarRegions } from "./regions";

/**
 * Converts a triangle mesh (STL/3MF/OBJ) into OpenCascade solids.
 *
 * Coplanar neighbouring triangles are merged into one planar face first, so flat areas become
 * real faces again (which can then be pushed, tilted, filleted …). Curved areas stay faceted.
 */
export function meshToSolids(positions: ArrayLike<number>, indices: ArrayLike<number>): Shape3D[] {
  const oc = getOC();
  const { P, I, N, regions } = planarRegions(positions, indices);
  const nV = P.length / 3;
  if (!regions.length) throw new Error("Keine Dreiecke");

  const pt = (i: number): Vec3 => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const sew = new oc.BRepBuilderAPI_Sewing(1e-4, true, true, true, false);
  const triFace = (t: number) => sew.Add(makePolygon([pt(I[t * 3]), pt(I[t * 3 + 1]), pt(I[t * 3 + 2])]).wrapped);

  for (const list of regions) {
    if (list.length === 1) {
      triFace(list[0]);
      continue;
    }
    // boundary = directed edges whose twin is not part of the region
    const inRegion = new Set<number>();
    for (const t of list) for (let k = 0; k < 3; k++) inRegion.add(I[t * 3 + k] * nV + I[t * 3 + ((k + 1) % 3)]);
    const next = new Map<number, number>();
    let bad = false;
    for (const t of list) {
      for (let k = 0; k < 3; k++) {
        const a = I[t * 3 + k], b = I[t * 3 + ((k + 1) % 3)];
        if (inRegion.has(b * nV + a)) continue;
        if (next.has(a)) bad = true;
        next.set(a, b);
      }
    }
    const loops: number[][] = [];
    if (!bad) {
      const seen = new Set<number>();
      for (const start of next.keys()) {
        if (seen.has(start)) continue;
        const loop: number[] = [];
        let v: number | undefined = start;
        while (v !== undefined && !seen.has(v)) {
          seen.add(v);
          loop.push(v);
          v = next.get(v);
        }
        if (v !== start) bad = true;
        loops.push(loop);
      }
    }
    const n: Vec3 = [N[list[0] * 3], N[list[0] * 3 + 1], N[list[0] * 3 + 2]];
    const area = (loop: number[]) => {
      let sx = 0, sy = 0, sz = 0;
      for (let i = 0; i < loop.length; i++) {
        const p = pt(loop[i]);
        const q = pt(loop[(i + 1) % loop.length]);
        sx += p[1] * q[2] - p[2] * q[1];
        sy += p[2] * q[0] - p[0] * q[2];
        sz += p[0] * q[1] - p[1] * q[0];
      }
      return (sx * n[0] + sy * n[1] + sz * n[2]) / 2;
    };
    const outer = loops.filter((l) => area(l) > 0);
    const holes = loops.filter((l) => area(l) <= 0);
    if (bad || outer.length !== 1) {
      list.forEach(triFace);
      continue;
    }
    try {
      const wire = (loop: number[]) => assembleWire(loop.map((v, i) => makeLine(pt(v), pt(loop[(i + 1) % loop.length]))));
      sew.Add(makeFace(wire(outer[0]), holes.map(wire)).wrapped);
    } catch {
      list.forEach(triFace);
    }
  }

  sew.Perform(new oc.Message_ProgressRange());
  const sewed = sew.SewedShape();
  sew.delete();
  const solids: Shape3D[] = [];
  const ex = new oc.TopExp_Explorer(sewed, oc.TopAbs_ShapeEnum.TopAbs_SHELL as never, oc.TopAbs_ShapeEnum.TopAbs_SHAPE as never);
  for (; ex.More(); ex.Next()) {
    const ms = new oc.BRepBuilderAPI_MakeSolid(oc.TopoDS.Shell(ex.Current()));
    const fix = new oc.ShapeFix_Solid(ms.Solid());
    fix.Perform(new oc.Message_ProgressRange());
    // merge the collinear edges left over from the triangle boundaries
    const unify = new oc.ShapeUpgrade_UnifySameDomain(fix.Solid(), true, false, false);
    unify.Build();
    solids.push(cast(unify.Shape()) as Shape3D);
    ms.delete();
    fix.delete();
    unify.delete();
  }
  ex.delete();
  if (!solids.length) throw new Error("Das Netz ist nicht geschlossen, kein Volumenkörper");
  return solids;
}

/** Reads a STEP file synchronously (exact B-rep geometry, converted to mm). */
export function readSTEP(bytes: Uint8Array): Shape3D[] {
  const oc = getOC();
  const name = `/import-${Math.random().toString(36).slice(2)}.step`;
  oc.FS.writeFile(name, bytes);
  const reader = new oc.STEPControl_Reader();
  try {
    const status = reader.ReadFile(name);
    if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) throw new Error("STEP-Datei konnte nicht gelesen werden");
    reader.TransferRoots(new oc.Message_ProgressRange());
    const shape = cast(reader.OneShape());
    const solids = (shape as Shape3D & { solids?: Shape3D[] }).solids ?? [];
    return solids.length ? solids : [shape as Shape3D];
  } finally {
    oc.FS.unlink(name);
    reader.delete();
  }
}
