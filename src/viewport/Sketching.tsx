import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import type { Sketch, SketchShape, Vec2, Vec3 } from "../types";
import { addSketch, beginTx, commit, currentSketchPlane, endTx, select, setTool, useStore, toast } from "../store/store";
import { fromPlane2D, planeBasis, PLANE_AXIS, PLANE_AXIS_NAME, toPlane2D } from "../lib/planes";
import { segmentsIntersect } from "../lib/geom";
import { fmtLen, fmtNum, parseLen, parseNumber, snapTo } from "../lib/units";
import { DimLabel, PlaneGroup, ScreenScale, sketchToThreeShape, vLabel } from "./Gizmos";
import { intersectPlane, pointerState, rayFromEvent, runDrag, toScreen } from "./interaction";
import { t } from "../i18n";

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
  const z = 0.02;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const st = useStore.getState();
    if (st.tool !== "select" || e.button !== 0 || pointerState.overHandle) return;
    e.stopPropagation();
    select([sketch.id]);
    // drag the sketch around on its plane
    const start = e.point.clone();
    const shape0 = sketch.shape;
    const snap = st.doc.settings.snap;
    const { u, v, n } = planeBasis(sketch.plane.orient);
    let began = false;
    const state = get();
    runDrag(
      state,
      {
        move(ev) {
          const p = intersectPlane(rayFromEvent(ev, state), n, start);
          if (!p) return;
          if (!began) {
            beginTx();
            began = true;
          }
          const d = p.clone().sub(start);
          const dx = ev.altKey ? d.dot(u) : snapTo(d.dot(u), snap);
          const dy = ev.altKey ? d.dot(v) : snapTo(d.dot(v), snap);
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
    <PlaneGroup plane={sketch.plane}>
      <mesh geometry={geo} position={[0, 0, z]} onPointerDown={onPointerDown} renderOrder={1}>
        <meshBasicMaterial color={SKETCH_COLOR} transparent opacity={selected ? 0.32 : 0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={outlinePoints(sketch.shape, z)} color={selected ? "#7dd3fc" : SKETCH_COLOR} lineWidth={selected ? 2.5 : 1.6} />
    </PlaneGroup>
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
  useStore((s) => s.view);
  useStore((s) => s.sketchPlanes);
  const plane = currentSketchPlane();
  const z = 0;
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);
  const rectMode = useStore((s) => s.rectMode);
  const circleMode = useStore((s) => s.circleMode);
  const get = useThree((s) => s.get);
  const [pts, setPts] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  /** line tool: length typed on the keyboard for the next segment ("30", or "30<45" for 30 at 45°) */
  const [typed, setTyped] = useState("");
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ptsRef = useRef(pts);
  ptsRef.current = pts;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  const snapPoint = (world: THREE.Vector3, ev: { shiftKey: boolean; altKey: boolean }): Vec2 => {
    const step = ev.altKey ? 0 : snap;
    const [px, py] = toPlane2D(plane, world);
    const p = { x: px, y: py };
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
        const s0 = toScreen(fromPlane2D(plane, cur[0][0], cur[0][1]), get());
        const s1 = toScreen(fromPlane2D(plane, x, y), get());
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
      toast(t("A closed shape needs at least 3 points"), "error");
      return;
    }
    if (segmentsIntersect(clean)) {
      toast(t("The lines must not cross each other"), "error");
      return;
    }
    addSketch({ kind: "poly", points: clean });
    setPts([]);
    setTyped("");
  };

  /** next point from the typed length: along the mouse direction, or at the typed angle */
  const placeTyped = (text: string) => {
    const cur = ptsRef.current;
    const last = cur[cur.length - 1];
    if (!last) return;
    const [lenText, angText] = text.split("<");
    const len = parseLen(lenText, unit);
    if (len === null || len <= 0) {
      toast(t("Type a length, for example 20, or 30<45 for 30 at 45°"), "error");
      return;
    }
    let ang: number;
    if (angText !== undefined && angText.trim() !== "") {
      const a = parseNumber(angText);
      if (a === null) {
        toast(t("Type a length, for example 20, or 30<45 for 30 at 45°"), "error");
        return;
      }
      ang = THREE.MathUtils.degToRad(a);
    } else {
      const c = cursorRef.current;
      const prev = cur[cur.length - 2];
      if (c && (c[0] !== last[0] || c[1] !== last[1])) ang = Math.atan2(c[1] - last[1], c[0] - last[0]);
      else if (prev) ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      else ang = 0;
    }
    const r = (v: number) => Math.round(v * 1e6) / 1e6;
    const p: Vec2 = [r(last[0] + Math.cos(ang) * len), r(last[1] + Math.sin(ang) * len)];
    setTyped("");
    if (cur.length >= 3 && Math.hypot(p[0] - cur[0][0], p[1] - cur[0][1]) < 1e-6) {
      finishPoly(cur);
      return;
    }
    setPts([...cur, p]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const cur = ptsRef.current;
      const line = tool === "poly";
      const stop = () => {
        e.stopImmediatePropagation();
        e.preventDefault();
      };
      // while drawing a line, number keys type the length of the next segment (instead of switching views)
      if (line && cur.length && !e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9.,+\-*/()<]$/.test(e.key)) {
        setTyped(typed + e.key);
        stop();
        return;
      }
      if (e.key === "Escape") {
        if (useStore.getState().planePick) useStore.setState({ planePick: false });
        else if (line && typed) setTyped("");
        else if (cur.length) setPts([]);
        else setTool("select");
        e.stopImmediatePropagation();
      } else if (e.key === "Enter" && line && typed) {
        placeTyped(typed);
        stop();
      } else if (e.key === "Enter" && line && cur.length >= 3) {
        finishPoly(cur);
      } else if (e.key === "Backspace" && line && typed) {
        setTyped(typed.slice(0, -1));
        stop();
      } else if (e.key === "Backspace" && line && cur.length) {
        setPts(cur.slice(0, -1));
        stop();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => useStore.setState({ dragInfo: null }), []);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || pointerState.overHandle || useStore.getState().planePick) return;
    e.stopPropagation();
    const p = snapPoint(e.point, e.nativeEvent);
    if (tool === "poly") {
      setTyped("");
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
    // world coordinates of the two in-plane axes
    const w = fromPlane2D(plane, p[0], p[1]);
    const ax = [0, 1, 2].filter((a) => a !== PLANE_AXIS[plane.orient]);
    useStore.setState({ dragInfo: ax.map((a) => `${PLANE_AXIS_NAME[a]} ${fmtNum(w.getComponent(a), unit)}`).join("   ") });
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
      labels.push({ pos: [r.x + r.w / 2, r.y - 5, z], mm: r.w, prefix: t("W") });
      labels.push({ pos: [r.x + r.w + 8, r.y + r.d / 2, z], mm: r.d, prefix: t(vLabel(plane)) });
    } else if (tool === "circle") {
      const c = circleFrom(pts[0], cursor, circleMode, snap) as Extract<SketchShape, { kind: "circle" }>;
      preview = c;
      labels.push({ pos: [c.cx, c.cy - c.d / 2 - 5, z], mm: c.d, prefix: "Ø" });
    }
  }

  // line tool: the segment being drawn, how long and at which angle, and whether the next click closes the shape
  const line = tool === "poly";
  const last = line ? pts[pts.length - 1] : undefined;
  const closing = line && pts.length >= 3 && cursor === pts[0];
  const segLen = last && cursor ? Math.hypot(cursor[0] - last[0], cursor[1] - last[1]) : 0;
  const segAng = last && cursor && segLen > 1e-9 ? (((Math.atan2(cursor[1] - last[1], cursor[0] - last[0]) * 180) / Math.PI) % 360 + 360) % 360 : null;
  const polyLine: Vec3[] = line && pts.length ? [...pts.map(([x, y]) => [x, y, z] as Vec3), ...(cursor ? [[cursor[0], cursor[1], z] as Vec3] : [])] : [];
  // dashed hint back to the start: the shape always ends there
  const closeHint: Vec3[] = line && pts.length >= 2 && cursor && !closing ? [[cursor[0], cursor[1], z], [pts[0][0], pts[0][1], z]] : [];
  const fillPts = line && pts.length >= 2 && cursor ? [...pts, ...(closing ? [] : [cursor])] : [];

  return (
    <PlaneGroup plane={plane}>
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
      {fillPts.length >= 3 && <PolyFill points={fillPts} z={z + 0.03} closing={closing} />}
      {closeHint.length > 0 && <Line points={closeHint} color="#fbbf24" lineWidth={1} dashed dashSize={2} gapSize={2} transparent opacity={0.45} depthTest={false} />}
      {polyLine.length > 1 && <Line points={polyLine} color={closing ? "#4ade80" : "#fbbf24"} lineWidth={2} depthTest={false} />}
      {line &&
        pts.map((p, i) => (
          <ScreenScale key={i} position={[p[0], p[1], z + 0.05]}>
            {i === 0 && pts.length >= 3 && (
              <mesh renderOrder={11}>
                <ringGeometry args={closing ? [8, 11, 32] : [7, 8.5, 32]} />
                <meshBasicMaterial color={closing ? "#4ade80" : "#f97316"} transparent opacity={closing ? 0.95 : 0.6} depthTest={false} />
              </mesh>
            )}
            <mesh renderOrder={12}>
              <circleGeometry args={[i === 0 && pts.length >= 3 ? 5 : 4, 20]} />
              <meshBasicMaterial color={i === 0 ? (closing ? "#4ade80" : "#f97316") : "#fbbf24"} depthTest={false} />
            </mesh>
          </ScreenScale>
        ))}
      {labels.map((l, i) => (
        <DimLabel key={i} position={l.pos} mm={l.mm} prefix={l.prefix} />
      ))}
      {line && last && cursor && (
        <Html position={[(last[0] + cursor[0]) / 2, (last[1] + cursor[1]) / 2, z]} center zIndexRange={[30, 10]} style={{ pointerEvents: "none" }}>
          {typed ? (
            <div className="dim-label line-typed">
              {typed}
              <span className="caret" />
              {!typed.includes("<") && <span className="opacity-60"> {unit === "in" ? t("in") : unit}</span>}
            </div>
          ) : (
            <div className="dim-label whitespace-nowrap">
              {closing ? (
                <span className="text-emerald-300">{t("Close shape")}</span>
              ) : (
                <>
                  {fmtLen(segLen, unit)}
                  {segAng !== null && <span className="opacity-70"> · {fmtNum(segAng, "mm", 1)}°</span>}
                </>
              )}
            </div>
          )}
        </Html>
      )}
    </PlaneGroup>
  );
}

/** light fill of the shape being drawn with the line tool */
function PolyFill({ points, z, closing }: { points: Vec2[]; z: number; closing: boolean }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ShapeGeometry(shape);
  }, [points]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[0, 0, z]} renderOrder={2}>
      <meshBasicMaterial color={closing ? "#4ade80" : "#fbbf24"} transparent opacity={closing ? 0.16 : 0.07} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
