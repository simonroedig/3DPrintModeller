import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, ChevronDown, ChevronUp, Crosshair, Eye, MoveHorizontal } from "lucide-react";
import { beginTx, endTx, planeTarget, setPlaneTargetValue, setView, useStore, type View } from "../store/store";
import { useMeshes } from "../cad/client";
import { AXIS_COLOR, ORIENT_LABEL, PLANE_AXIS, PLANE_AXIS_NAME, viewAxis } from "../lib/planes";
import { planeSnapTargets } from "../lib/planeSnap";
import { fmtLen, snapTo } from "../lib/units";
import { INSET_ID, insetMmPerPx, invalidateInset, usePlaneTarget } from "../viewport/PlaneInset";
import { LenField } from "./fields";
import { t } from "../i18n";

const COLLAPSE_KEY = "printmodeller.planePanel.collapsed";

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return [collapsed, toggle] as const;
}

const VIEW_FROM: Partial<Record<View, string>> = {
  top: "top to bottom",
  front: "front to back",
  back: "back to front",
  left: "left to right",
  right: "right to left",
};

/** in a 2D view: the same small 3D preview, showing the eye you look through */
function ViewPanel({ view }: { view: View }) {
  const [collapsed, toggle] = useCollapsed();
  const ref = useRef<HTMLDivElement>(null);
  const axis = viewAxis(view) ?? 2;
  const color = AXIS_COLOR[axis];
  const from = VIEW_FROM[view];
  useLayoutEffect(() => {
    invalidateInset();
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => invalidateInset());
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed]);
  return (
    <div className="absolute top-[54px] right-3 z-10 w-[248px] plane-panel" style={{ borderColor: `${color}88` }}>
      <div className="pp-bar flex items-center gap-2 px-2.5 pt-2 pb-1.5">
        <Eye size={14} style={{ color }} className="shrink-0" />
        <span className="text-[12px] font-semibold text-ink-100">{t("View direction")}</span>
        <span className="text-[11px] text-ink-400 truncate">{from && t(from)}</span>
        <button className="btn ghost !h-6 !px-1 ml-auto" title={collapsed ? t("Show preview") : t("Collapse preview")} onClick={toggle}>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && (
        <div
          id={INSET_ID}
          ref={ref}
          className="plane-inset relative h-[150px] !cursor-pointer"
          title={t("Click: go to the 3D view · Hold the right mouse button in the model: orbit in 3D directly")}
          onClick={() => setView("iso")}
        >
          <span className="absolute right-1.5 bottom-1.5 text-[11px] text-ink-500 flex items-center gap-1 pointer-events-none">
            <Box size={13} /> {t("Click: 3D")}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Small 3D preview (top right) that shows where the sketch plane lives.
 * Drag in it to move the plane, type an exact value, or snap it onto a body face.
 */
export function PlanePanel() {
  const target = usePlaneTarget();
  const unit = useStore((s) => s.doc.settings.unit);
  const snap = useStore((s) => s.doc.settings.snap);
  const planePick = useStore((s) => s.planePick);
  const view = useStore((s) => s.view);
  const bodies = useStore((s) => s.doc.bodies);
  const meshes = useMeshes((s) => s.meshes);
  const [collapsed, toggleCollapsed] = useCollapsed();
  const [snapLabel, setSnapLabel] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const plane = target?.plane;
  const axis = plane ? PLANE_AXIS[plane.orient] : 2;
  const targets = useMemo(() => (plane ? planeSnapTargets(axis) : []), [plane ? axis : -1, bodies, meshes]); // eslint-disable-line react-hooks/exhaustive-deps

  // the canvas only redraws on demand: ask for a frame whenever the preview appears or changes size
  useLayoutEffect(() => {
    invalidateInset();
  });
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => invalidateInset());
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed, !!plane]); // eslint-disable-line react-hooks/exhaustive-deps

  // wheel = one grid step
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = planeTarget()?.plane.value;
      if (cur === undefined) return;
      const step = (snap || 1) * (e.shiftKey ? 10 : 1);
      setPlaneTargetValue(snapTo(cur + (e.deltaY < 0 ? step : -step), step));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [collapsed, !!plane, snap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plane) return view === "iso" ? null : <ViewPanel view={view} />;
  const color = AXIS_COLOR[axis];
  const axisName = PLANE_AXIS_NAME[axis];

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const v0 = plane.value;
    const mmPerPx = insetMmPerPx(axis, el.getBoundingClientRect().height);
    let began = false;
    const move = (ev: PointerEvent) => {
      // right or up = towards +axis
      const px = ev.clientX - x0 - (ev.clientY - y0);
      if (!began) {
        if (Math.abs(px) < 3) return;
        began = true;
        beginTx();
        useStore.setState({ planeDrag: true });
      }
      const raw = v0 + px * mmPerPx * (ev.shiftKey ? 0.2 : 1);
      let v = raw;
      let label: string | null = null;
      if (!ev.altKey) {
        // faces of other parts win over the grid
        let best = 8 * mmPerPx;
        for (const tg of targets) {
          const d = Math.abs(tg.value - raw);
          if (d < best) {
            best = d;
            v = tg.value;
            label = tg.label;
          }
        }
        if (label === null) v = snapTo(raw, snap);
      }
      setSnapLabel(label);
      setPlaneTargetValue(v);
      useStore.setState({
        dragInfo: `${t("Plane {axis} {value}", { axis: axisName, value: fmtLen(v, unit) })}${label ? ` · ${t("flush with {target}", { target: label })}` : ""}`,
      });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (began) endTx();
      useStore.setState({ planeDrag: false, dragInfo: null });
      setSnapLabel(null);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  return (
    <div className="absolute top-[54px] right-3 z-10 w-[248px] plane-panel" style={{ borderColor: `${color}88` }}>
      <div className="pp-bar flex items-center gap-2 px-2.5 pt-2 pb-1.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="text-[12px] font-semibold text-ink-100">{t("Sketch plane")}</span>
        <span className="text-[11px] text-ink-400 truncate">
          {target.sketch ? `${target.sketch.name} · ` : ""}
          {t(ORIENT_LABEL[plane.orient])}
        </span>
        <button className="btn ghost !h-6 !px-1 ml-auto" title={collapsed ? t("Show preview") : t("Collapse preview")} onClick={toggleCollapsed}>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && (
        <div
          id={INSET_ID}
          ref={viewRef}
          className="plane-inset relative h-[150px]"
          title={t("Drag left/right to move the plane · snaps to faces · Alt: free · Mouse wheel: grid step")}
          onPointerDown={onPointerDown}
        >
          <span className="absolute left-1.5 top-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${color}26`, color }}>
            {axisName} = {fmtLen(plane.value, unit)}
          </span>
          {snapLabel && (
            <span className="absolute left-1.5 bottom-1.5 text-[11px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">{t("flush: {target}", { target: snapLabel })}</span>
          )}
          {!snapLabel && (
            <span className="absolute right-1.5 bottom-1.5 text-[11px] text-ink-500 flex items-center gap-1 pointer-events-none">
              <MoveHorizontal size={13} /> {t("drag")}
            </span>
          )}
        </div>
      )}
      <div className="pp-bar">
      <div className="flex items-center gap-1.5 p-2">
        <div className="flex-1 min-w-0">
          <LenField label={t("Plane {axis}", { axis: axisName })} mm={plane.value} onChange={(v) => setPlaneTargetValue(v)} title={t("Exact position of the sketch plane")} />
        </div>
        <button
          className={`btn !h-[30px] !px-2 ${planePick ? "primary" : ""}`}
          title={t("Click a face of a body, the sketch then lies exactly on it")}
          onClick={() => useStore.setState({ planePick: !planePick })}
        >
          <Crosshair size={15} />
        </button>
      </div>
      <div className="px-2 pb-2">
        <select
          className="plane-snap-select w-full"
          value=""
          title={t("Put the plane exactly on a face")}
          onChange={(e) => {
            const tg = targets[Number(e.target.value)];
            if (tg) setPlaneTargetValue(tg.value);
          }}
        >
          <option value="">{t("Flush with face …")}</option>
          {targets.map((tg, i) => (
            <option key={i} value={i}>
              {tg.label} ({axisName} {fmtLen(tg.value, unit)})
            </option>
          ))}
        </select>
      </div>
      {planePick && <div className="px-2.5 pb-2 text-[11px] text-sky-300">{t("Now click a flat face in the model · Esc cancels")}</div>}
      </div>
    </div>
  );
}
