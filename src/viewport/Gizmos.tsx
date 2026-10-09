import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import type { Body, Sketch, SketchShape, Unit, Vec3 } from "../types";
import { beginTx, endTx, extrudeSketch, setBodyShape, updateBodies, updateSketch, useStore, toast } from "../store/store";
import { bodyMatrix, unionBox } from "../lib/geom";
import { useMeshes } from "../cad/client";
import { handleSpecs, resizeWorld } from "../lib/shapeEdit";
import { fmtLen, fmtNum, parseLen, snapTo } from "../lib/units";
import { pointerState, startAxisDrag, worldPerPixel } from "./interaction";

/* ------------------------------------------------------------------ */

/** Keeps its children at a constant on-screen size (1 unit = 1 px). */
export function ScreenScale({ position, children }: { position: Vec3 | THREE.Vector3; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    g.getWorldPosition(tmp);
    g.scale.setScalar(worldPerPixel(state, tmp));
  });
  const p = position instanceof THREE.Vector3 ? (position.toArray() as Vec3) : position;
  return (
    <group ref={ref} position={p}>
      {children}
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);
const hoverOwner: { current: object | null } = { current: null };

export function Handle({
  position,
  dir,
  color = "#3b82f6",
  onDown,
  arrow = false,
  title,
}: {
  position: Vec3 | THREE.Vector3;
  dir: Vec3 | THREE.Vector3;
  color?: string;
  onDown: (e: ThreeEvent<PointerEvent>) => void;
  arrow?: boolean;
  title?: string;
}) {
  const [hover, setHover] = useState(false);
  const token = useMemo(() => ({}), []);
  const release = () => {
    if (hoverOwner.current === token) {
      hoverOwner.current = null;
      pointerState.overHandle = false;
      document.body.style.cursor = "";
    }
  };
  // never leave the global "over handle" flag dangling when a hovered handle disappears
  useEffect(() => release, []); // eslint-disable-line react-hooks/exhaustive-deps
  const d = dir instanceof THREE.Vector3 ? dir.clone().normalize() : new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d);
  const c = hover ? "#fbbf24" : color;
  const s = hover ? 1.25 : 1;
  return (
    <ScreenScale position={position}>
      <group
        quaternion={q}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          onDown(e);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          hoverOwner.current = token;
          pointerState.overHandle = true;
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          setHover(false);
          release();
        }}
      >
        {arrow ? (
          <>
            <mesh position={[0, 22 * s, 0]} renderOrder={20}>
              <cylinderGeometry args={[1.6 * s, 1.6 * s, 44 * s, 8]} />
              <meshBasicMaterial color={c} depthTest={false} transparent />
            </mesh>
            <mesh position={[0, 50 * s, 0]} renderOrder={20}>
              <coneGeometry args={[6 * s, 16 * s, 16]} />
              <meshBasicMaterial color={c} depthTest={false} transparent />
            </mesh>
            {/* generous invisible hit area */}
            <mesh position={[0, 32, 0]}>
              <cylinderGeometry args={[9, 9, 64, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </>
        ) : (
          <>
            <mesh renderOrder={20}>
              <sphereGeometry args={[5.5 * s, 16, 12]} />
              <meshBasicMaterial color={c} depthTest={false} transparent />
            </mesh>
            <mesh renderOrder={19}>
              <sphereGeometry args={[7.5 * s, 16, 12]} />
              <meshBasicMaterial color="#0b0e14" depthTest={false} transparent opacity={0.6} />
            </mesh>
            <mesh>
              <sphereGeometry args={[11, 8, 6]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </>
        )}
      </group>
      {title && hover && (
        <Html center position={[0, -18, 0]} style={{ pointerEvents: "none" }}>
          <div className="hud-chip">{title}</div>
        </Html>
      )}
    </ScreenScale>
  );
}

/* ------------------------------------------------------------------ */

export function DimLabel({
  position,
  mm,
  prefix,
  onCommit,
}: {
  position: Vec3;
  mm: number;
  prefix?: string;
  onCommit?: (mm: number) => void;
}) {
  const unit = useStore((s) => s.doc.settings.unit);
  const [editing, setEditing] = useState(false);
  const text = `${prefix ? prefix + " " : ""}${fmtLen(mm, unit)}`;
  return (
    <Html position={position} center zIndexRange={[30, 10]} style={{ pointerEvents: onCommit ? "auto" : "none" }}>
      {editing ? (
        <input
          className="dim-input"
          autoFocus
          defaultValue={fmtNum(mm, unit)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              const v = parseLen(e.currentTarget.value, unit);
              if (v !== null && v > 0) onCommit?.(v);
              setEditing(false);
            } else if (e.key === "Escape") setEditing(false);
          }}
          onBlur={(e) => {
            const v = parseLen(e.currentTarget.value, unit);
            if (v !== null && v > 0 && Math.abs(v - mm) > 1e-9) onCommit?.(v);
            setEditing(false);
          }}
        />
      ) : (
        <div
          className={`dim-label ${onCommit ? "editable" : ""}`}
          title={onCommit ? "Klicken zum Bearbeiten" : undefined}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onCommit && setEditing(true)}
        >
          {text}
        </div>
      )}
    </Html>
  );
}

function DimLine({ a, b }: { a: Vec3; b: Vec3 }) {
  return <Line points={[a, b]} color="#9fb4d1" lineWidth={1} transparent opacity={0.8} depthTest={false} renderOrder={15} />;
}

/* ------------------------------------------------------------------ */

export function SelectionGizmos() {
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const bodies = useStore((s) => s.doc.bodies);
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);
  // re-render when meshes arrive so the boxes are exact
  useMeshes((s) => s.meshes);
  const get = useThree((s) => s.get);

  const sel = bodies.filter((b) => selection.includes(b.id));
  if (tool !== "select" || !sel.length) return null;
  const box = unionBox(sel);
  if (box.isEmpty()) return null;
  const single = sel.length === 1 ? sel[0] : null;
  const size = box.getSize(new THREE.Vector3());
  const off = Math.max(4, size.length() * 0.06);
  const { min, max } = box;

  const commitWorld = (axis: number) => (v: number) => {
    if (!single) return;
    const patch = resizeWorld(single, axis, v);
    if (!patch) {
      toast(single.shape.kind === "group" ? "Gruppen lassen sich nicht skalieren – trenne sie zuerst" : "Nur bei 90°-Drehungen direkt editierbar", "error");
      return;
    }
    updateBodies({ [single.id]: patch });
  };
  const editable = single && single.shape.kind !== "group";

  return (
    <group>
      <DimLine a={[min.x, min.y - off, min.z]} b={[max.x, min.y - off, min.z]} />
      <DimLabel position={[(min.x + max.x) / 2, min.y - off, min.z]} mm={size.x} prefix="X" onCommit={editable ? commitWorld(0) : undefined} />
      <DimLine a={[max.x + off, min.y, min.z]} b={[max.x + off, max.y, min.z]} />
      <DimLabel position={[max.x + off, (min.y + max.y) / 2, min.z]} mm={size.y} prefix="Y" onCommit={editable ? commitWorld(1) : undefined} />
      <DimLine a={[min.x - off, max.y + off, min.z]} b={[min.x - off, max.y + off, max.z]} />
      <DimLabel position={[min.x - off, max.y + off, (min.z + max.z) / 2]} mm={size.z} prefix="Z" onCommit={editable ? commitWorld(2) : undefined} />
      {single && <ResizeHandles body={single} snap={snap} unit={unit} get={get} />}
    </group>
  );
}

function ResizeHandles({ body, snap, get, unit }: { body: Body; snap: number; unit: Unit; get: () => RootState }) {
  const specs = handleSpecs(body.shape);
  const m = bodyMatrix(body);
  const q = new THREE.Quaternion(...body.quaternion);
  return (
    <>
      {specs.map((spec) => {
        const wp = new THREE.Vector3(...spec.pos).applyMatrix4(m);
        const wd = new THREE.Vector3(...spec.dir).applyQuaternion(q);
        return (
          <Handle
            key={spec.id}
            position={wp}
            dir={wd}
            title={spec.label}
            onDown={(e) => {
              const p0 = body.position;
              beginTx();
              const ok = startAxisDrag(
                get(),
                e.nativeEvent,
                wp,
                wd,
                (t, ev) => {
                  const r = spec.apply(t, ev.altKey ? 0 : snap);
                  const sh = new THREE.Vector3(...r.shift).applyQuaternion(q);
                  setBodyShape(body.id, r.shape, [p0[0] + sh.x, p0[1] + sh.y, p0[2] + sh.z]);
                  useStore.setState({ dragInfo: `${spec.label} ${fmtLen(r.value, unit)}` });
                },
                () => {
                  endTx();
                  useStore.setState({ dragInfo: null });
                },
              );
              if (!ok) endTx();
            }}
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function sketchToThreeShape(s: SketchShape): THREE.Shape {
  const shape = new THREE.Shape();
  if (s.kind === "rect") {
    shape.moveTo(s.x, s.y);
    shape.lineTo(s.x + s.w, s.y);
    shape.lineTo(s.x + s.w, s.y + s.d);
    shape.lineTo(s.x, s.y + s.d);
    shape.closePath();
  } else if (s.kind === "circle") {
    shape.absarc(s.cx, s.cy, s.d / 2, 0, Math.PI * 2, false);
  } else {
    s.points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
  }
  return shape;
}

export function sketchCentroid(s: SketchShape): [number, number] {
  if (s.kind === "rect") return [s.x + s.w / 2, s.y + s.d / 2];
  if (s.kind === "circle") return [s.cx, s.cy];
  const n = s.points.length;
  return [s.points.reduce((a, p) => a + p[0], 0) / n, s.points.reduce((a, p) => a + p[1], 0) / n];
}

export function SketchGizmos() {
  const selection = useStore((s) => s.selection);
  const sketches = useStore((s) => s.doc.sketches);
  const sketch = sketches.find((s) => selection.length === 1 && s.id === selection[0]);
  if (!sketch) return null;
  return <SketchGizmo sketch={sketch} />;
}

function SketchGizmo({ sketch }: { sketch: Sketch }) {
  const get = useThree((s) => s.get);
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);
  const view = useStore((s) => s.view);
  const [h, setH] = useState<number | null>(null);
  const hRef = useRef<number | null>(null);
  const s = sketch.shape;
  const [cx, cy] = sketchCentroid(s);
  const z = sketch.z;
  const shape3 = useMemo(() => sketchToThreeShape(s), [s]);
  const extrudeGeo = useMemo(() => {
    if (h === null || Math.abs(h) < 1e-6) return null;
    return new THREE.ExtrudeGeometry(shape3, { depth: Math.abs(h), bevelEnabled: false, curveSegments: 48 });
  }, [shape3, h]);

  const dims: ReactNode[] = [];
  const off = 6;
  if (s.kind === "rect") {
    dims.push(
      <DimLabel key="w" position={[s.x + s.w / 2, s.y - off, z]} mm={s.w} prefix="B" onCommit={(v) => updateSketch(sketch.id, { ...s, w: v })} />,
      <DimLabel key="d" position={[s.x + s.w + off * 1.6, s.y + s.d / 2, z]} mm={s.d} prefix="T" onCommit={(v) => updateSketch(sketch.id, { ...s, d: v })} />,
    );
  } else if (s.kind === "circle") {
    dims.push(
      <DimLabel key="d" position={[s.cx, s.cy - s.d / 2 - off, z]} mm={s.d} prefix="Ø" onCommit={(v) => updateSketch(sketch.id, { ...s, d: v })} />,
    );
  } else {
    s.points.forEach((p, i) => {
      const q = s.points[(i + 1) % s.points.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      dims.push(<DimLabel key={i} position={[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z]} mm={len} />);
    });
  }

  return (
    <group>
      {dims}
      {view !== "top" && (
        <Handle
          position={[cx, cy, z]}
          dir={[0, 0, 1]}
          arrow
          color="#22c55e"
          title="Ziehen zum Extrudieren"
          onDown={(e) => {
            const ok = startAxisDrag(
              get(),
              e.nativeEvent,
              new THREE.Vector3(cx, cy, z),
              new THREE.Vector3(0, 0, 1),
              (t, ev) => {
                const v = ev.altKey ? t : snapTo(t, snap);
                hRef.current = v;
                setH(v);
                useStore.setState({ dragInfo: `Höhe ${fmtLen(v, unit)}` });
              },
              () => {
                useStore.setState({ dragInfo: null });
                const cur = hRef.current;
                hRef.current = null;
                setH(null);
                if (cur !== null && Math.abs(cur) > 1e-6) extrudeSketch(sketch.id, cur);
              },
            );
            if (!ok) toast("In dieser Ansicht nicht ziehbar – nutze die 3D-Ansicht oder das Panel");
          }}
        />
      )}
      {extrudeGeo && h !== null && (
        <>
          <mesh geometry={extrudeGeo} position={[0, 0, z + (h < 0 ? h : 0)]}>
            <meshStandardMaterial color="#22c55e" transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <DimLabel position={[cx, cy, z + h + Math.sign(h) * 6]} mm={Math.abs(h)} prefix="H" />
        </>
      )}
    </group>
  );
}
