import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Body, MeshData, Vec3 } from "../types";
import { geometryKey } from "../cad/key";
import { useMeshes } from "../cad/client";
import { useStore } from "../store/store";
import { bodyMatrix } from "../lib/geom";
import { snapTo } from "../lib/units";
import { DimLabel, Handle } from "./Gizmos";
import { bodyMeshes, pointerState, raycasterFromEvent, startAxisDrag, toScreen } from "./interaction";

export function edgeRefsFor(mesh: MeshData, idx: number[]) {
  return idx.map((i) => ({ mid: mesh.edges[i].mid, dir: mesh.edges[i].dir }));
}

export function selectAllEdges(bodyId: string) {
  const b = useStore.getState().doc.bodies.find((x) => x.id === bodyId);
  if (!b) return;
  const mesh = useMeshes.getState().meshes[geometryKey(b)]?.mesh;
  if (!mesh) return;
  const idx = mesh.edges.map((e, i) => (e.len > 0 ? i : -1)).filter((i) => i >= 0);
  useStore.setState({ edgeSel: { bodyId, idx, refs: edgeRefsFor(mesh, idx) } });
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

export function FilletTool() {
  const tool = useStore((s) => s.tool);
  if (tool !== "fillet") return null;
  return <FilletPicker />;
}

function FilletPicker() {
  const get = useThree((s) => s.get);
  const bodies = useStore((s) => s.doc.bodies);
  const edgeSel = useStore((s) => s.edgeSel);
  const fillet = useStore((s) => s.fillet);
  const snap = useStore((s) => s.doc.settings.snap);
  const meshes = useMeshes((s) => s.meshes);
  const [hover, setHover] = useState<{ bodyId: string; idx: number } | null>(null);

  const base = useMemo(() => {
    const map = new Map<string, MeshData>();
    for (const b of bodies) {
      const m = meshes[geometryKey(b)]?.mesh;
      if (m && !b.hidden) map.set(b.id, m);
    }
    return map;
  }, [bodies, meshes]);

  const pickRef = useRef<(ev: PointerEvent) => { bodyId: string; idx: number } | null>(() => null);
  pickRef.current = (ev: PointerEvent) => {
    const state = get();
    const rect = state.gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(ev.clientX - rect.left, ev.clientY - rect.top);
    const rc = raycasterFromEvent(ev, state);
    const hits = rc.intersectObjects([...bodyMeshes.values()], false);
    const hitDist = hits[0]?.distance ?? Infinity;
    let best: { bodyId: string; idx: number } | null = null;
    let bestD = 9;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const body of bodies) {
      const mesh = base.get(body.id);
      if (!mesh) continue;
      const m = bodyMatrix(body);
      const P = mesh.edgePositions;
      mesh.edges.forEach((e, i) => {
        if (e.len < 0) return;
        for (let k = e.start; k < e.start + e.count; k += 2) {
          a.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(m);
          b.set(P[k * 3 + 3], P[k * 3 + 4], P[k * 3 + 5]).applyMatrix4(m);
          const { d, u } = distToSegment(mouse, toScreen(a, state), toScreen(b, state));
          if (d >= bestD) continue;
          const p = a.clone().lerp(b, u);
          const depth = p.distanceTo(rc.ray.origin);
          if (depth > hitDist + Math.max(0.5, hitDist * 0.004)) continue; // hidden behind geometry
          bestD = d;
          best = { bodyId: body.id, idx: i };
        }
      });
    }
    return best;
  };

  useEffect(() => {
    const el = get().gl.domElement;
    let downAt: { x: number; y: number } | null = null;
    const onMove = (ev: PointerEvent) => {
      if (pointerState.dragging || pointerState.overHandle) return;
      const h = pickRef.current(ev);
      setHover((cur) => (cur?.bodyId === h?.bodyId && cur?.idx === h?.idx ? cur : h));
      el.style.cursor = h ? "pointer" : "";
    };
    const onDown = (ev: PointerEvent) => {
      downAt = ev.button === 0 && !pointerState.overHandle ? { x: ev.clientX, y: ev.clientY } : null;
    };
    const onUp = (ev: PointerEvent) => {
      if (!downAt || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 4) return;
      downAt = null;
      const h = pickRef.current(ev);
      const s = useStore.getState();
      if (!h) {
        useStore.setState({ edgeSel: null });
        return;
      }
      const body = s.doc.bodies.find((b) => b.id === h.bodyId) as Body;
      const mesh = useMeshes.getState().meshes[geometryKey(body)]?.mesh;
      if (!mesh) return;
      const multi = ev.shiftKey || ev.ctrlKey || ev.metaKey;
      let idx: number[];
      if (s.edgeSel && s.edgeSel.bodyId === h.bodyId && multi) {
        idx = s.edgeSel.idx.includes(h.idx) ? s.edgeSel.idx.filter((i) => i !== h.idx) : [...s.edgeSel.idx, h.idx];
      } else if (s.edgeSel && s.edgeSel.bodyId === h.bodyId && s.edgeSel.idx.length === 1 && s.edgeSel.idx[0] === h.idx) {
        idx = [];
      } else {
        idx = [h.idx];
      }
      useStore.setState({
        edgeSel: idx.length ? { bodyId: h.bodyId, idx, refs: edgeRefsFor(mesh, idx) } : null,
        selection: [h.bodyId],
      });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.style.cursor = "";
    };
  }, [get]);

  const hoverBody = hover ? bodies.find((b) => b.id === hover.bodyId) : undefined;
  const hoverMesh = hover ? base.get(hover.bodyId) : undefined;
  const selBody = edgeSel ? bodies.find((b) => b.id === edgeSel.bodyId) : undefined;
  const selMesh = edgeSel ? base.get(edgeSel.bodyId) : undefined;

  let handle: React.ReactNode = null;
  if (selBody && selMesh && edgeSel && edgeSel.idx.length) {
    const e = selMesh.edges[edgeSel.idx[0]];
    if (e) {
      const m = bodyMatrix(selBody);
      const q = new THREE.Quaternion(...selBody.quaternion);
      const mid = new THREE.Vector3(...e.mid).applyMatrix4(m);
      const dir = new THREE.Vector3(...e.handleDir).applyQuaternion(q).normalize();
      const r = fillet.radius;
      const step = snap <= 0.5 ? snap : 0.5;
      const pos = mid.clone().addScaledVector(dir, r);
      handle = (
        <>
          <Handle
            position={pos}
            dir={dir}
            arrow
            color="#f97316"
            title="Ziehen für Radius"
            onDown={(ev) => {
              const r0 = useStore.getState().fillet.radius;
              startAxisDrag(get(), ev.nativeEvent, pos, dir, (t, pe) => {
                const v = Math.max(0, pe.altKey ? r0 + t : snapTo(r0 + t, step));
                useStore.setState({ fillet: { ...useStore.getState().fillet, radius: Math.round(v * 1000) / 1000 } });
              });
            }}
          />
          <DimLabel
            position={pos.clone().addScaledVector(dir, -r / 2).toArray() as Vec3}
            mm={r}
            prefix={fillet.type === "fillet" ? "R" : "F"}
            onCommit={(v) => useStore.setState({ fillet: { ...useStore.getState().fillet, radius: v } })}
          />
        </>
      );
    }
  }

  return (
    <group>
      {hoverBody && hoverMesh && hover && (
        <group position={hoverBody.position} quaternion={hoverBody.quaternion}>
          <Line points={edgePoints(hoverMesh, hover.idx)} segments color="#fbbf24" lineWidth={4} depthTest={false} renderOrder={16} />
        </group>
      )}
      {selBody && selMesh && edgeSel && (
        <group position={selBody.position} quaternion={selBody.quaternion}>
          {edgeSel.idx.map((i) =>
            selMesh.edges[i] ? (
              <Line key={i} points={edgePoints(selMesh, i)} segments color="#f97316" lineWidth={3.5} depthTest={false} renderOrder={17} />
            ) : null,
          )}
        </group>
      )}
      {handle}
    </group>
  );
}
