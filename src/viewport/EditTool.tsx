import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { axisColorOf } from "../lib/planes";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Body, MeshData, Vec3 } from "../types";
import { geometryKey } from "../cad/key";
import { useMeshes } from "../cad/client";
import { isMeshBody, noEdit, useStore } from "../store/store";
import { clearEditSelection, faceExtentFromHinge, selectFace } from "../store/edit";
import { bodyMatrix } from "../lib/geom";
import { fmtLen, snapTo } from "../lib/units";
import { DimLabel, Handle } from "./Gizmos";
import { pointerState, raycasterFromEvent, startAxisDrag, toScreen, worldPerPixel } from "./interaction";

export function edgeRefsFor(mesh: MeshData, idx: number[]) {
  return idx.map((i) => ({ mid: mesh.edges[i].mid, dir: mesh.edges[i].dir }));
}

function baseMesh(b: Body) {
  return useMeshes.getState().meshes[geometryKey(b)]?.mesh;
}

export function selectAllEdges(bodyId: string) {
  const b = useStore.getState().doc.bodies.find((x) => x.id === bodyId);
  const mesh = b && baseMesh(b);
  if (!mesh) return;
  const idx = mesh.edges.map((e, i) => (e.len > 0 ? i : -1)).filter((i) => i >= 0);
  useStore.setState({ ...noEdit, edgeSel: { bodyId, idx, refs: edgeRefsFor(mesh, idx) } });
}

function edgePoints(mesh: MeshData, i: number): Vec3[] {
  const e = mesh.edges[i];
  const P = mesh.edgePositions;
  const out: Vec3[] = [];
  for (let k = e.start; k < e.start + e.count; k++) out.push([P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]);
  return out;
}

function distToSegment(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) {
  const ab = b.clone().sub(a);
  const l2 = ab.lengthSq();
  const u = l2 > 0 ? Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / l2)) : 0;
  return { d: a.clone().addScaledVector(ab, u).distanceTo(p), u };
}

/** outward bisector of an edge: dragging along it rounds, against it chamfers */
function outDir(mesh: MeshData, i: number) {
  const e = mesh.edges[i];
  const d = new THREE.Vector3(...e.handleDir);
  return e.convex ? d.negate() : d;
}

type Hover = { bodyId: string; kind: "edge" | "face"; idx: number } | null;

export function EditTool() {
  const tool = useStore((s) => s.tool);
  if (tool !== "edit") return null;
  return <EditPicker />;
}

function useFaceGeometry(mesh: MeshData | undefined, idx: number | undefined) {
  const geo = useMemo(() => {
    if (!mesh || idx === undefined || idx < 0 || !mesh.faces[idx]) return null;
    const f = mesh.faces[idx];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.setDrawRange(f.start, f.count);
    return g;
  }, [mesh, idx]);
  useEffect(() => () => geo?.dispose(), [geo]);
  return geo;
}

function FaceOverlay({ body, mesh, idx, color, opacity }: { body: Body; mesh: MeshData; idx: number; color: string; opacity: number }) {
  const geo = useFaceGeometry(mesh, idx);
  if (!geo) return null;
  return (
    <group position={body.position} quaternion={body.quaternion}>
      <mesh geometry={geo} renderOrder={6}>
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
    </group>
  );
}

function EditPicker() {
  const get = useThree((s) => s.get);
  const bodies = useStore((s) => s.doc.bodies);
  const edgeSel = useStore((s) => s.edgeSel);
  const faceSel = useStore((s) => s.faceSel);
  const faceOp = useStore((s) => s.faceOp);
  const fillet = useStore((s) => s.fillet);
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);
  const meshes = useMeshes((s) => s.meshes);
  const [hover, setHover] = useState<Hover>(null);

  const base = useMemo(() => {
    const map = new Map<string, MeshData>();
    for (const b of bodies) {
      const m = meshes[geometryKey(b)]?.mesh;
      if (m && !b.hidden) map.set(b.id, m);
    }
    return map;
  }, [bodies, meshes]);

  // invisible pick meshes built from the un-previewed geometry
  const pickMeshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const b of bodies) {
      const m = base.get(b.id);
      if (!m || isMeshBody(b)) continue; // plain meshes offer no CAD edges/faces
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
      g.setIndex(new THREE.BufferAttribute(m.indices, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(...b.position);
      mesh.quaternion.set(...b.quaternion);
      mesh.updateMatrixWorld(true);
      mesh.userData.bodyId = b.id;
      list.push(mesh);
    }
    return list;
  }, [bodies, base]);
  useEffect(() => () => pickMeshes.forEach((m) => m.geometry.dispose()), [pickMeshes]);

  const pickRef = useRef<(ev: PointerEvent) => Hover>(() => null);
  pickRef.current = (ev: PointerEvent) => {
    const state = get();
    const s = useStore.getState();
    const rect = state.gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(ev.clientX - rect.left, ev.clientY - rect.top);
    const rc = raycasterFromEvent(ev, state);
    const hits = rc.intersectObjects(pickMeshes, false);
    const hitDist = hits[0]?.distance ?? Infinity;
    const hitPoint = hits[0]?.point;
    const seg = new THREE.Line3();
    const tmp = new THREE.Vector3();
    // while choosing a hinge only the straight edges of the selected face are candidates
    const hingeMode = s.faceSel && s.faceOp.mode === "tilt" && !s.faceOp.hinge ? s.faceSel : null;
    let best: Hover = null;
    let bestD = 8;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const body of bodies) {
      if (hingeMode && body.id !== hingeMode.bodyId) continue;
      const mesh = base.get(body.id);
      if (!mesh) continue;
      const m = bodyMatrix(body);
      const P = mesh.edgePositions;
      mesh.edges.forEach((e, i) => {
        if (e.len < 0) return;
        if (hingeMode && (!e.line || !e.faces.includes(hingeMode.idx))) return;
        for (let k = e.start; k < e.start + e.count; k += 2) {
          a.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(m);
          b.set(P[k * 3 + 3], P[k * 3 + 4], P[k * 3 + 5]).applyMatrix4(m);
          const { d, u } = distToSegment(mouse, toScreen(a, state), toScreen(b, state));
          if (d >= bestD) continue;
          const p = a.clone().lerp(b, u);
          const depth = p.distanceTo(rc.ray.origin);
          if (depth > hitDist + 0.5) {
            // something is in front – unless it is one of the edge's own faces seen at a grazing angle
            seg.set(a, b);
            const near = seg.closestPointToPoint(hitPoint!, true, tmp).distanceTo(hitPoint!);
            if (near > Math.max(1.5, worldPerPixel(state, p) * 10)) continue;
          }
          bestD = d;
          best = { bodyId: body.id, kind: "edge", idx: i };
        }
      });
    }
    if (best || hingeMode) return best;
    const hit = hits[0];
    if (hit && hit.faceIndex != null) {
      const bodyId = hit.object.userData.bodyId as string;
      const mesh = base.get(bodyId);
      if (mesh) {
        const t = hit.faceIndex * 3;
        const idx = mesh.faces.findIndex((f) => t >= f.start && t < f.start + f.count);
        if (idx >= 0 && mesh.faces[idx].normal) return { bodyId, kind: "face", idx };
      }
    }
    return null;
  };

  useEffect(() => {
    const el = get().gl.domElement;
    let downAt: { x: number; y: number } | null = null;
    const same = (a: Hover, b: Hover) => a?.bodyId === b?.bodyId && a?.kind === b?.kind && a?.idx === b?.idx;
    const onMove = (ev: PointerEvent) => {
      if (pointerState.dragging || pointerState.overHandle || ev.buttons) return;
      const h = pickRef.current(ev);
      setHover((cur) => (same(cur, h) ? cur : h));
      el.style.cursor = h ? "pointer" : "";
    };
    const onLeave = () => setHover(null);
    const onDown = (ev: PointerEvent) => {
      downAt = ev.button === 0 && !pointerState.overHandle ? { x: ev.clientX, y: ev.clientY } : null;
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.button !== 0 || !downAt || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 4) return;
      downAt = null;
      const h = pickRef.current(ev);
      const s = useStore.getState();
      if (s.faceSel && s.faceOp.mode === "tilt" && !s.faceOp.hinge) {
        // picking the hinge of a tilt
        if (h?.kind === "edge") {
          const mesh = base.get(h.bodyId)!;
          const e = mesh.edges[h.idx];
          useStore.setState({ faceOp: { ...s.faceOp, angle: 0, hinge: { idx: h.idx, ref: { mid: e.mid, dir: e.dir } } } });
        }
        return;
      }
      if (!h) {
        clearEditSelection();
        return;
      }
      const mesh = base.get(h.bodyId);
      if (!mesh) return;
      if (h.kind === "face") {
        selectFace(h.bodyId, mesh, h.idx);
        return;
      }
      const multi = ev.shiftKey || ev.ctrlKey || ev.metaKey;
      const cur = s.edgeSel?.bodyId === h.bodyId ? s.edgeSel.idx : [];
      let idx: number[];
      if (multi) idx = cur.includes(h.idx) ? cur.filter((i) => i !== h.idx) : [...cur, h.idx];
      else idx = cur.length === 1 && cur[0] === h.idx ? [] : [h.idx];
      const fresh = !multi || !cur.length;
      useStore.setState({
        ...noEdit,
        edgeSel: idx.length ? { bodyId: h.bodyId, idx, refs: edgeRefsFor(mesh, idx) } : null,
        selection: [h.bodyId],
        // a fresh selection starts at zero – drag out for a rounding, in for a chamfer
        fillet: fresh ? { ...s.fillet, radius: 0 } : s.fillet,
      });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.style.cursor = "";
    };
  }, [get, base]);

  const bodyOf = (id?: string) => bodies.find((b) => b.id === id);
  const hoverBody = bodyOf(hover?.bodyId);
  const hoverMesh = hover ? base.get(hover.bodyId) : undefined;
  const edgeBody = bodyOf(edgeSel?.bodyId);
  const edgeMesh = edgeSel ? base.get(edgeSel.bodyId) : undefined;
  const faceBody = bodyOf(faceSel?.bodyId);
  const faceMesh = faceSel ? base.get(faceSel.bodyId) : undefined;
  const radiusStep = snap <= 0.5 ? snap : 0.5;

  /* ---------------- handles ---------------- */
  let handles: React.ReactNode = null;
  if (edgeBody && edgeMesh && edgeSel?.idx.length) {
    const i = edgeSel.idx[0];
    const e = edgeMesh.edges[i];
    if (e) {
      const m = bodyMatrix(edgeBody);
      const q = new THREE.Quaternion(...edgeBody.quaternion);
      const mid = new THREE.Vector3(...e.mid).applyMatrix4(m);
      const dir = outDir(edgeMesh, i).applyQuaternion(q).normalize();
      const signed = fillet.type === "fillet" ? fillet.radius : -fillet.radius;
      const pos = mid.clone().addScaledVector(dir, signed);
      handles = (
        <>
          <Handle
            position={pos}
            dir={dir}
            arrow
            both
            color={fillet.type === "fillet" ? "#f97316" : "#e879f9"}
            title="Raus ziehen: Rundung · rein ziehen: Fase"
            onDown={(ev) => {
              const v0 = signed;
              startAxisDrag(get(), ev.nativeEvent, pos, dir, (t, pe) => {
                let v = v0 + t;
                v = pe.altKey ? v : snapTo(v, radiusStep);
                v = Math.round(v * 1000) / 1000;
                useStore.setState({ fillet: { type: v >= 0 ? "fillet" : "chamfer", radius: Math.abs(v) } });
              });
            }}
          />
          {fillet.radius > 0 && (
            <DimLabel
              position={pos.clone().addScaledVector(dir, Math.sign(signed) * 4).toArray() as Vec3}
              mm={fillet.radius}
              prefix={fillet.type === "fillet" ? "R" : "Fase"}
              onCommit={(v) => useStore.setState({ fillet: { ...useStore.getState().fillet, radius: v } })}
            />
          )}
        </>
      );
    }
  } else if (faceBody && faceMesh && faceSel) {
    const f = faceMesh.faces[faceSel.idx];
    const m = bodyMatrix(faceBody);
    const q = new THREE.Quaternion(...faceBody.quaternion);
    if (f?.normal && f.center) {
      const n = new THREE.Vector3(...f.normal).applyQuaternion(q).normalize();
      const c = new THREE.Vector3(...f.center).applyMatrix4(m);
      if (faceOp.mode === "push") {
        const pos = c.clone().addScaledVector(n, faceOp.distance);
        handles = (
          <>
            <Handle
              position={pos}
              dir={n}
              arrow
              both
              color={axisColorOf(n)}
              title="Ziehen: Fläche verschieben"
              onDown={(ev) => {
                const d0 = faceOp.distance;
                startAxisDrag(get(), ev.nativeEvent, pos, n, (t, pe) => {
                  const v = pe.altKey ? d0 + t : snapTo(d0 + t, snap);
                  useStore.setState({ faceOp: { ...useStore.getState().faceOp, distance: Math.round(v * 1000) / 1000 } });
                });
              }}
            />
            {Math.abs(faceOp.distance) > 1e-9 && (
              <DimLabel
                position={c.clone().addScaledVector(n, faceOp.distance / 2).toArray() as Vec3}
                mm={Math.abs(faceOp.distance)}
                prefix={faceOp.distance > 0 ? "+" : "−"}
              />
            )}
          </>
        );
      } else if (faceOp.hinge) {
        const ext = faceExtentFromHinge(faceMesh, faceSel.idx, faceOp.hinge.idx);
        if (ext && ext.w > 1e-6) {
          const hgt = ext.w * Math.tan((faceOp.angle * Math.PI) / 180);
          const farLocal = ext.p0.clone().addScaledVector(ext.u, ext.w).addScaledVector(ext.n, hgt);
          const pos = farLocal.applyMatrix4(m);
          const angleLabel = `${Math.abs(Math.round(faceOp.angle * 10) / 10).toString().replace(".", ",")}°`;
          handles = (
            <>
              <Handle
                position={pos}
                dir={n}
                arrow
                both
                color="#e879f9"
                title="Hoch: Keil hinzufügen · runter: Keil wegnehmen"
                onDown={(ev) => {
                  const h0 = hgt;
                  startAxisDrag(get(), ev.nativeEvent, pos, n, (t, pe) => {
                    const h = pe.altKey ? h0 + t : snapTo(h0 + t, snap);
                    const angle = Math.round(((Math.atan2(h, ext.w) * 180) / Math.PI) * 10) / 10;
                    useStore.setState({ faceOp: { ...useStore.getState().faceOp, angle: Math.max(-85, Math.min(85, angle)) } });
                    useStore.setState({ dragInfo: `Winkel ${angle.toString().replace(".", ",")}° · Höhe ${fmtLen(Math.abs(h), unit)}` });
                  }, () => useStore.setState({ dragInfo: null }));
                }}
              />
              {Math.abs(faceOp.angle) > 1e-9 && (
                <DimLabel position={pos.clone().addScaledVector(n, hgt >= 0 ? 6 : -6).toArray() as Vec3} mm={Math.abs(hgt)} prefix={angleLabel} />
              )}
            </>
          );
        }
      }
    }
  }

  const hingeMesh = faceSel && faceOp.hinge ? base.get(faceSel.bodyId) : undefined;

  return (
    <group>
      {hover && hoverBody && hoverMesh && hover.kind === "face" && (
        <FaceOverlay body={hoverBody} mesh={hoverMesh} idx={hover.idx} color="#60a5fa" opacity={0.28} />
      )}
      {faceSel && faceBody && faceMesh && <FaceOverlay body={faceBody} mesh={faceMesh} idx={faceSel.idx} color="#22c55e" opacity={0.35} />}
      {hover && hoverBody && hoverMesh && hover.kind === "edge" && (
        <group position={hoverBody.position} quaternion={hoverBody.quaternion}>
          <Line points={edgePoints(hoverMesh, hover.idx)} segments color="#fbbf24" lineWidth={4.5} depthTest={false} renderOrder={16} />
        </group>
      )}
      {edgeBody && edgeMesh && edgeSel && (
        <group position={edgeBody.position} quaternion={edgeBody.quaternion}>
          {edgeSel.idx.map((i) =>
            edgeMesh.edges[i] ? <Line key={i} points={edgePoints(edgeMesh, i)} segments color="#f97316" lineWidth={4} depthTest={false} renderOrder={17} /> : null,
          )}
        </group>
      )}
      {faceBody && hingeMesh && faceOp.hinge && hingeMesh.edges[faceOp.hinge.idx] && (
        <group position={faceBody.position} quaternion={faceBody.quaternion}>
          <Line points={edgePoints(hingeMesh, faceOp.hinge.idx)} segments color="#e879f9" lineWidth={5} depthTest={false} renderOrder={17} />
        </group>
      )}
      {handles}
    </group>
  );
}
