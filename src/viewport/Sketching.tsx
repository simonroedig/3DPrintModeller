import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Sketch, SketchShape, Vec2, Vec3 } from "../types";
import { addSketch, beginTx, commit, endTx, select, setTool, useStore, toast } from "../store/store";
import { segmentsIntersect } from "../lib/geom";
import { fmtNum, snapTo } from "../lib/units";
import { DimLabel, ScreenScale, sketchToThreeShape } from "./Gizmos";
import { intersectPlane, pointerState, rayFromEvent, runDrag, toScreen } from "./interaction";

const SKETCH_COLOR = "#38bdf8";

function outlinePoints(s: SketchShape, z: number): Vec3[] {
  if (s.kind === "rect") {
    return [
      [s.x, s.y, z],
      [s.x + s.w, s.y, z],
      [s.x + s.w, s.y + s.d, z],
      [s.x, s.y + s.d, z],
      [s.x, s.y, z],
    ];
  }
  if (s.kind === "circle") {
    const pts: Vec3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push([s.cx + (Math.cos(a) * s.d) / 2, s.cy + (Math.sin(a) * s.d) / 2, z]);
    }
    return pts;
  }
  return [...s.points.map(([x, y]) => [x, y, z] as Vec3), [s.points[0][0], s.points[0][1], z]];
}

export function SketchView({ sketch }: { sketch: Sketch }) {
  const selected = useStore((s) => s.selection.includes(sketch.id));
  const get = useThree((s) => s.get);
  const geo = useMemo(() => new THREE.ShapeGeometry(sketchToThreeShape(sketch.shape), 48), [sketch.shape]);
  useEffect(() => () => geo.dispose(), [geo]);
  const z = sketch.z + 0.02;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const st = useStore.getState();
    if (st.tool !== "select" || e.button !== 0 || pointerState.overHandle) return;
    e.stopPropagation();
    select([sketch.id]);
    // drag the sketch around on its plane
    const start = e.point.clone();
    const shape0 = sketch.shape;
    const snap = st.doc.settings.snap;
    let began = false;
    const state = get();
    runDrag(
      state,
      {
        move(ev) {
          const p = intersectPlane(rayFromEvent(ev, state), new THREE.Vector3(0, 0, 1), start);
          if (!p) return;
          if (!began) {
            beginTx();
            began = true;
          }
          const dx = ev.altKey ? p.x - start.x : snapTo(p.x - start.x, snap);
          const dy = ev.altKey ? p.y - start.y : snapTo(p.y - start.y, snap);
          const doc = useStore.getState().doc;
          let moved: SketchShape;
          if (shape0.kind === "rect") moved = { ...shape0, x: shape0.x + dx, y: shape0.y + dy };
          else if (shape0.kind === "circle") moved = { ...shape0, cx: shape0.cx + dx, cy: shape0.cy + dy };
          else moved = { ...shape0, points: shape0.points.map(([x, y]) => [x + dx, y + dy] as Vec2) };
          commit({ ...doc, sketches: doc.sketches.map((s) => (s.id === sketch.id ? { ...s, shape: moved } : s)) });
        },
        up() {
          if (began) endTx();
        },
      },
      e.nativeEvent,
    );
  };

  return (
    <group>
      <mesh geometry={geo} position={[0, 0, z]} onPointerDown={onPointerDown} renderOrder={1}>
        <meshBasicMaterial color={SKETCH_COLOR} transparent opacity={selected ? 0.32 : 0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={outlinePoints(sketch.shape, z)} color={selected ? "#7dd3fc" : SKETCH_COLOR} lineWidth={selected ? 2.5 : 1.6} />
    </group>
  );
}

/* ------------------------------------------------------------------ */

export function SketchTool() {
  const tool = useStore((s) => s.tool);
  if (tool !== "rect" && tool !== "circle" && tool !== "poly") return null;
  return <SketchDrawer key={tool} tool={tool} />;
}

function rectFrom(a: Vec2, b: Vec2, mode: "corner" | "center"): SketchShape {
  if (mode === "corner") {
    return { kind: "rect", x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]) };
  }
  const hw = Math.abs(b[0] - a[0]);
  const hd = Math.abs(b[1] - a[1]);
  return { kind: "rect", x: a[0] - hw, y: a[1] - hd, w: hw * 2, d: hd * 2 };
}

function circleFrom(a: Vec2, b: Vec2, mode: "center" | "corner", snap: number): SketchShape {
  if (mode === "center") {
    const d = snapTo(2 * Math.hypot(b[0] - a[0], b[1] - a[1]), snap);
    return { kind: "circle", cx: a[0], cy: a[1], d };
  }
  const s = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  return {
    kind: "circle",
    cx: a[0] + (Math.sign(b[0] - a[0]) || 1) * (s / 2),
    cy: a[1] + (Math.sign(b[1] - a[1]) || 1) * (s / 2),
    d: s,
  };
}

function SketchDrawer({ tool }: { tool: "rect" | "circle" | "poly" }) {
  const z = useStore((s) => s.sketchZ);
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);
  const rectMode = useStore((s) => s.rectMode);
  const circleMode = useStore((s) => s.circleMode);
  const get = useThree((s) => s.get);
  const [pts, setPts] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ptsRef = useRef(pts);
  ptsRef.current = pts;

  const snapPoint = (p: THREE.Vector3, ev: { shiftKey: boolean; altKey: boolean }): Vec2 => {
    const step = ev.altKey ? 0 : snap;
    let x = snapTo(p.x, step);
    let y = snapTo(p.y, step);
    const cur = ptsRef.current;
    if (tool === "poly" && cur.length) {
      const last = cur[cur.length - 1];
      if (ev.shiftKey) {
        // lock to 15° increments
        const ang = Math.round(Math.atan2(p.y - last[1], p.x - last[0]) / (Math.PI / 12)) * (Math.PI / 12);
        const len = snapTo(Math.hypot(p.x - last[0], p.y - last[1]), step);
        x = last[0] + Math.cos(ang) * len;
        y = last[1] + Math.sin(ang) * len;
      }
      // snap onto the first point to close
      if (cur.length >= 3) {
        const s0 = toScreen(new THREE.Vector3(cur[0][0], cur[0][1], z), get());
        const s1 = toScreen(new THREE.Vector3(x, y, z), get());
        if (s0.distanceTo(s1) < 12) return cur[0];
      }
    }
    return [x, y];
  };

  const finishRectCircle = (a: Vec2, b: Vec2) => {
    const shape = tool === "rect" ? rectFrom(a, b, rectMode) : circleFrom(a, b, circleMode, snap);
    if ((shape.kind === "rect" && (shape.w <= 0 || shape.d <= 0)) || (shape.kind === "circle" && shape.d <= 0)) {
      setPts([]);
      return;
    }
    addSketch(shape);
    setPts([]);
  };

  const finishPoly = (points: Vec2[]) => {
    const clean = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
    if (clean.length > 3 && clean[0][0] === clean[clean.length - 1][0] && clean[0][1] === clean[clean.length - 1][1]) clean.pop();
    if (clean.length < 3) {
      toast("Ein Polygon braucht mindestens 3 Punkte", "error");
      return;
    }
    if (segmentsIntersect(clean)) {
      toast("Das Polygon darf sich nicht selbst schneiden", "error");
      return;
    }
    addSketch({ kind: "poly", points: clean });
    setPts([]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const cur = ptsRef.current;
      if (e.key === "Escape") {
        if (cur.length) setPts([]);
        else setTool("select");
        e.stopImmediatePropagation();
      } else if (e.key === "Enter" && tool === "poly" && cur.length >= 3) {
        finishPoly(cur);
      } else if (e.key === "Backspace" && tool === "poly" && cur.length) {
        setPts(cur.slice(0, -1));
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => useStore.setState({ dragInfo: null }), []);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || pointerState.overHandle) return;
    e.stopPropagation();
    const p = snapPoint(e.point, e.nativeEvent);
    if (tool === "poly") {
      if (pts.length >= 3 && p === pts[0]) {
        finishPoly(pts);
        return;
      }
      const last = pts[pts.length - 1];
      if (last && last[0] === p[0] && last[1] === p[1]) return;
      setPts([...pts, p]);
      return;
    }
    if (!pts.length) {
      setPts([p]);
      down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, moved: false };
    } else {
      finishRectCircle(pts[0], p);
      down.current = null;
    }
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const p = snapPoint(e.point, e.nativeEvent);
    setCursor(p);
    if (down.current && Math.hypot(e.nativeEvent.clientX - down.current.x, e.nativeEvent.clientY - down.current.y) > 5) {
      down.current.moved = true;
    }
    useStore.setState({ dragInfo: `X ${fmtNum(p[0], unit)}   Y ${fmtNum(p[1], unit)}` });
  };

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    if (tool !== "poly" && pts.length === 1 && down.current?.moved) {
      finishRectCircle(pts[0], snapPoint(e.point, e.nativeEvent));
    }
    down.current = null;
  };

  // preview
  let preview: SketchShape | null = null;
  const labels: { pos: Vec3; mm: number; prefix?: string }[] = [];
  if (cursor && pts.length) {
    if (tool === "rect") {
      const r = rectFrom(pts[0], cursor, rectMode) as Extract<SketchShape, { kind: "rect" }>;
      preview = r;
      labels.push({ pos: [r.x + r.w / 2, r.y - 5, z], mm: r.w, prefix: "B" });
      labels.push({ pos: [r.x + r.w + 8, r.y + r.d / 2, z], mm: r.d, prefix: "T" });
    } else if (tool === "circle") {
      const c = circleFrom(pts[0], cursor, circleMode, snap) as Extract<SketchShape, { kind: "circle" }>;
      preview = c;
      labels.push({ pos: [c.cx, c.cy - c.d / 2 - 5, z], mm: c.d, prefix: "Ø" });
    } else {
      const last = pts[pts.length - 1];
      labels.push({
        pos: [(last[0] + cursor[0]) / 2, (last[1] + cursor[1]) / 2, z],
        mm: Math.hypot(cursor[0] - last[0], cursor[1] - last[1]),
      });
    }
  }

  const polyLine: Vec3[] = tool === "poly" && pts.length ? [...pts.map(([x, y]) => [x, y, z] as Vec3), ...(cursor ? [[cursor[0], cursor[1], z] as Vec3] : [])] : [];

  return (
    <group>
      <mesh position={[0, 0, z]} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={() => tool === "poly" && pts.length >= 3 && finishPoly(pts)}>
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {cursor && (
        <group position={[cursor[0], cursor[1], z + 0.05]}>
          <Line points={[[-3, 0, 0], [3, 0, 0]]} color="#fbbf24" lineWidth={1.5} depthTest={false} />
          <Line points={[[0, -3, 0], [0, 3, 0]]} color="#fbbf24" lineWidth={1.5} depthTest={false} />
        </group>
      )}
      {preview && <Line points={outlinePoints(preview, z + 0.05)} color="#fbbf24" lineWidth={2} depthTest={false} />}
      {polyLine.length > 1 && <Line points={polyLine} color="#fbbf24" lineWidth={2} depthTest={false} />}
      {tool === "poly" &&
        pts.map((p, i) => (
          <ScreenScale key={i} position={[p[0], p[1], z + 0.05]}>
            <mesh renderOrder={12}>
              <circleGeometry args={[i === 0 && pts.length >= 3 ? 6 : 4, 20]} />
              <meshBasicMaterial color={i === 0 ? "#f97316" : "#fbbf24"} depthTest={false} />
            </mesh>
          </ScreenScale>
        ))}
      {labels.map((l, i) => (
        <DimLabel key={i} position={l.pos} mm={l.mm} prefix={l.prefix} />
      ))}
    </group>
  );
}
