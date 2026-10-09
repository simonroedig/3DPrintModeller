import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Body, EdgeFeature, MeshData, Vec3 } from "../types";
import { geometryKey } from "../cad/key";
import { requestMesh, useMeshes } from "../cad/client";
import { beginTx, endTx, layFlat, select, setTool, translateBodies, useStore } from "../store/store";
import { unionBox, worldBox } from "../lib/geom";
import { snapMove } from "../lib/snapping";
import { fmtNum } from "../lib/units";
import { bodyMeshes, intersectPlane, pointerState, rayFromEvent, runDrag, worldPerPixel } from "./interaction";

export function useBodyMesh(slot: string, body: { shape: Body["shape"]; features: EdgeFeature[] }) {
  const key = useMemo(() => geometryKey(body), [body.shape, body.features]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    requestMesh(slot, key, body.shape, body.features);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const entry = useMeshes((s) => s.meshes[key]);
  const last = useRef<MeshData | undefined>(undefined);
  if (entry?.mesh) last.current = entry.mesh;
  return { mesh: entry?.mesh ?? last.current, pending: !entry, error: entry?.error, key };
}

export function useGeometry(mesh?: MeshData) {
  const geo = useMemo(() => {
    if (!mesh) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }, [mesh]);
  const edges = useMemo(() => {
    if (!mesh) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.edgePositions, 3));
    return g;
  }, [mesh]);
  useEffect(() => () => geo?.dispose(), [geo]);
  useEffect(() => () => edges?.dispose(), [edges]);
  return { geo, edges };
}

function faceAt(mesh: MeshData, triangle: number) {
  const idx = triangle * 3;
  return mesh.faces.findIndex((f) => idx >= f.start && idx < f.start + f.count);
}

const ACCENT = new THREE.Color("#3b82f6");

export function BodyView({ body }: { body: Body }) {
  const selected = useStore((s) => s.selection.includes(body.id));
  const tool = useStore((s) => s.tool);
  const preview = useStore((s) =>
    s.tool === "fillet" && s.edgeSel?.bodyId === body.id && s.fillet.radius > 0 ? s.fillet : null,
  );
  const edgeSel = useStore((s) => (s.edgeSel?.bodyId === body.id ? s.edgeSel : null));
  const get = useThree((s) => s.get);

  const features = useMemo(() => {
    if (!preview || !edgeSel || !edgeSel.refs.length) return body.features;
    return [...body.features, { id: "preview", type: preview.type, radius: preview.radius, edges: edgeSel.refs }];
  }, [body.features, preview, edgeSel]);

  const { mesh } = useBodyMesh(body.id, { shape: body.shape, features });
  const { geo, edges } = useGeometry(mesh);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const [hoverFace, setHoverFace] = useState(-1);

  useEffect(() => {
    const m = meshRef.current;
    if (m) {
      m.userData.bodyId = body.id;
      bodyMeshes.set(body.id, m);
    }
    return () => {
      bodyMeshes.delete(body.id);
    };
  }, [body.id, geo]);

  const faceGeo = useMemo(() => {
    if (!geo || !mesh || hoverFace < 0) return null;
    const f = mesh.faces[hoverFace];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", geo.getAttribute("position"));
    g.setAttribute("normal", geo.getAttribute("normal"));
    g.setIndex(geo.getIndex());
    g.setDrawRange(f.start, f.count);
    return g;
  }, [geo, mesh, hoverFace]);

  if (!geo || !edges) return null;

  const color = new THREE.Color(body.color);
  const emissive = body.hole && selected ? ACCENT : color;
  const emissiveIntensity = selected ? (body.hole ? 0.3 : 0.2) : hover && tool === "select" ? 0.1 : 0;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || pointerState.overHandle) return;
    const s = useStore.getState();
    if (s.tool === "layflat") {
      e.stopPropagation();
      if (!mesh || e.faceIndex == null) return;
      const fi = faceAt(mesh, e.faceIndex);
      const n = mesh.faces[fi]?.normal;
      if (!n) return;
      const wn = new THREE.Vector3(...n).applyQuaternion(new THREE.Quaternion(...body.quaternion));
      layFlat(body.id, [wn.x, wn.y, wn.z]);
      select([body.id]);
      setTool("select");
      return;
    }
    if (s.tool !== "select") return;
    e.stopPropagation();
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    const wasSelected = s.selection.includes(body.id);
    if (!wasSelected) select(multi ? [...s.selection, body.id] : [body.id]);
    startMoveDrag(get(), e.nativeEvent, e.point.clone(), (moved) => {
      if (moved) return;
      const cur = useStore.getState().selection;
      if (multi && wasSelected) select(cur.filter((id) => id !== body.id));
      else if (!multi && wasSelected && cur.length > 1) select([body.id]);
    });
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== "layflat" || !mesh || e.faceIndex == null) return;
    e.stopPropagation();
    const fi = faceAt(mesh, e.faceIndex);
    setHoverFace(mesh.faces[fi]?.normal ? fi : -1);
  };

  return (
    <group position={body.position} quaternion={body.quaternion}>
      <mesh
        ref={meshRef}
        geometry={geo}
        renderOrder={body.hole ? 2 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => {
          setHover(false);
          setHoverFace(-1);
        }}
      >
        {body.hole ? (
          <meshStandardMaterial
            color="#b6c0cc"
            transparent
            opacity={selected ? 0.45 : 0.3}
            depthWrite={false}
            roughness={0.8}
            side={THREE.DoubleSide}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
          />
        ) : (
          <meshStandardMaterial
            color={color}
            roughness={0.62}
            metalness={0.02}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        )}
      </mesh>
      <lineSegments geometry={edges} renderOrder={3}>
        <lineBasicMaterial
          color={selected ? "#bfdbfe" : body.hole ? "#64748b" : "#06080c"}
          transparent
          opacity={selected ? 0.95 : 0.75}
          depthWrite={false}
        />
      </lineSegments>
      {faceGeo && (
        <mesh geometry={faceGeo} renderOrder={4}>
          <meshBasicMaterial color="#facc15" transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      )}
    </group>
  );
}

/** Drag the current selection in the view plane with grid + face snapping. */
export function startMoveDrag(
  state: RootState,
  ev: PointerEvent,
  hit: THREE.Vector3,
  onEnd?: (moved: boolean) => void,
) {
  const { doc, selection, view } = useStore.getState();
  const ids = selection.filter((id) => doc.bodies.some((b) => b.id === id));
  if (!ids.length) return;
  const moving = doc.bodies.filter((b) => ids.includes(b.id));
  const startPos: Record<string, Vec3> = Object.fromEntries(moving.map((b) => [b.id, b.position]));
  const startBox = unionBox(moving);
  const others = doc.bodies.filter((b) => !ids.includes(b.id) && !b.hidden).map((b) => worldBox(b));
  const normal = new THREE.Vector3(view === "right" ? 1 : 0, view === "front" ? 1 : 0, view === "front" || view === "right" ? 0 : 1);
  const axes = view === "front" ? [0, 2] : view === "right" ? [1, 2] : [0, 1];
  const unit = doc.settings.unit;
  let began = false;
  runDrag(
    state,
    {
      move(e) {
        const p = intersectPlane(rayFromEvent(e, state), normal, hit);
        if (!p) return;
        if (!began) {
          beginTx();
          began = true;
        }
        const raw: Vec3 = [p.x - hit.x, p.y - hit.y, p.z - hit.z];
        for (let a = 0; a < 3; a++) if (!axes.includes(a)) raw[a] = 0;
        const thr = worldPerPixel(state, p) * 12;
        const { delta, guides } = snapMove(startBox, raw, axes, others, e.altKey ? 0 : doc.settings.snap, e.altKey ? 0 : thr);
        translateBodies(ids, delta, startPos);
        const names = ["X", "Y", "Z"];
        useStore.setState({
          guides,
          dragInfo: axes.map((a) => `Δ${names[a]} ${fmtNum(delta[a], unit)}`).join("   "),
        });
      },
      up(_e, moved) {
        if (began) endTx();
        useStore.setState({ guides: [], dragInfo: null });
        onEnd?.(moved);
      },
    },
    ev,
  );
}
