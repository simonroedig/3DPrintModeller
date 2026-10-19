import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import type { Body, Feature, MeshData, Vec3 } from "../types";
import { geometryKey } from "../cad/key";
import { requestMesh, useMeshes } from "../cad/client";
import { beginTx, endTx, layFlat, pickSketchPlane, select, setTool, toast, translateBodies, useStore } from "../store/store";
import { displayGeometry } from "../store/edit";
import { unionBox, worldBox } from "../lib/geom";
import { snapMove } from "../lib/snapping";
import { viewAxis } from "../lib/planes";
import { fmtNum } from "../lib/units";
import { bodyMeshes, intersectPlane, pointerState, rayFromEvent, runDrag, worldPerPixel } from "./interaction";
import { t } from "../i18n";

export function useBodyMesh(slot: string, body: { shape: Body["shape"]; features: Feature[] }) {
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

/** edge colour that stands out against the body colour (used in the edit mode) */
function edgeContrast(body: Body) {
  if (body.hole) return "#e2e8f0";
  const c = new THREE.Color(body.color);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return lum > 0.45 ? "#0b0d12" : "#f8fafc";
}

export function BodyView({ body }: { body: Body }) {
  const selected = useStore((s) => s.selection.includes(body.id));
  const tool = useStore((s) => s.tool);
  const planePick = useStore((s) => s.planePick);
  const editing = useStore((s) => s.edgeSel?.bodyId === body.id || s.faceSel?.bodyId === body.id);
  const fillet = useStore((s) => (editing ? s.fillet : null));
  const faceOp = useStore((s) => (editing ? s.faceOp : null));
  const edgeSel = useStore((s) => (s.edgeSel?.bodyId === body.id ? s.edgeSel : null));
  const faceSel = useStore((s) => (s.faceSel?.bodyId === body.id ? s.faceSel : null));
  const get = useThree((s) => s.get);

  // geometry incl. a live preview of the edit being set up (fillet, face push, tilt)
  const display = useMemo(
    () =>
      editing
        ? displayGeometry({ tool, edgeSel, faceSel, fillet: fillet!, faceOp: faceOp! }, body)
        : { shape: body.shape, position: body.position, features: body.features },
    [editing, tool, edgeSel, faceSel, fillet, faceOp, body],
  );

  const { mesh } = useBodyMesh(body.id, { shape: display.shape, features: display.features });
  const { geo, edges } = useGeometry(mesh);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const [hoverFace, setHoverFace] = useState(-1);
  useEffect(() => {
    if (!planePick && tool !== "layflat") setHoverFace(-1);
  }, [planePick, tool]);

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
    if (s.planePick) {
      e.stopPropagation();
      if (!mesh || e.faceIndex == null) return;
      const n = mesh.faces[faceAt(mesh, e.faceIndex)]?.normal;
      if (!n) {
        toast(t("Please click a flat face"), "error");
        return;
      }
      const wn = new THREE.Vector3(...n).applyQuaternion(new THREE.Quaternion(...body.quaternion));
      pickSketchPlane(wn, e.point.clone());
      setHoverFace(-1);
      return;
    }
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
    if ((tool !== "layflat" && !planePick) || !mesh || e.faceIndex == null) return;
    e.stopPropagation();
    const fi = faceAt(mesh, e.faceIndex);
    const n = mesh.faces[fi]?.normal;
    // plane picking only offers faces a sketch plane can lie on
    const ok = n && (!planePick || Math.max(...new THREE.Vector3(...n).applyQuaternion(new THREE.Quaternion(...body.quaternion)).toArray().map(Math.abs)) > 0.999);
    setHoverFace(ok ? fi : -1);
  };

  return (
    <group position={display.position} quaternion={body.quaternion}>
      <mesh
        ref={meshRef}
        geometry={geo}
        renderOrder={body.hole ? 2 : 0}
        onPointerDown={onPointerDown}
        onDoubleClick={(e) => {
          if (useStore.getState().tool !== "select" || e.button !== 0) return;
          e.stopPropagation();
          select([body.id]);
          setTool("edit");
        }}
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
          color={tool === "edit" ? edgeContrast(body) : selected ? "#bfdbfe" : body.hole ? "#64748b" : "#06080c"}
          transparent
          opacity={tool === "edit" ? 1 : selected ? 0.95 : 0.75}
          depthWrite={false}
        />
      </lineSegments>
      {body.shape.kind === "group" && selected && tool === "select" && <GroupGhosts body={body} />}
      {faceGeo && (
        <mesh geometry={faceGeo} renderOrder={4}>
          <meshBasicMaterial color={planePick ? "#38bdf8" : "#facc15"} transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
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
  const va = viewAxis(view) ?? 2;
  const normal = new THREE.Vector3().setComponent(va, 1);
  const axes = [0, 1, 2].filter((a) => a !== va);
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

/** parts of a combined body that are not visible in the result: subtracted tools, holes, the focused part */
function GroupGhosts({ body }: { body: Body }) {
  const focus = useStore((s) => (s.groupFocus?.groupId === body.id ? s.groupFocus.childId : null));
  if (body.shape.kind !== "group") return null;
  const op = body.shape.op ?? "union";
  return (
    <>
      {body.shape.children.map((c) =>
        c.id === focus || c.hole || op === "intersect" ? <GhostPart key={c.id} part={c} focused={c.id === focus} /> : null,
      )}
    </>
  );
}

function GhostPart({ part, focused }: { part: Body; focused: boolean }) {
  const { mesh } = useBodyMesh(`ghost:${part.id}`, part);
  const { geo, edges } = useGeometry(mesh);
  if (!geo || !edges) return null;
  const color = focused ? "#f59e0b" : part.hole ? "#fb7185" : "#94a3b8";
  return (
    <group position={part.position} quaternion={part.quaternion}>
      <mesh geometry={geo} renderOrder={5}>
        <meshBasicMaterial color={color} transparent opacity={focused ? 0.16 : 0.08} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={edges} renderOrder={6}>
        <lineBasicMaterial color={color} transparent opacity={focused ? 0.95 : 0.55} depthTest={false} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
