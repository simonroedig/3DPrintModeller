import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  Box,
  Circle,
  CircleDot,
  CircleHelp,
  Cone,
  Cylinder,
  Download,
  FileUp,
  FolderOpen,
  Globe,
  Hexagon,
  Languages,
  MousePointer2,
  Redo2,
  Save,
  Scan,
  Square,
  SquareRoundCorner,
  TriangleRight,
  Undo2,
  Ungroup,
} from "lucide-react";
import { cancelWork, stalledFor, useMeshes } from "../cad/client";
import {
  addPrimitive,
  fitView,
  combineSelection,
  redo,
  setSettings,
  setTool,
  setUnit,
  setView,
  toast,
  undo,
  ungroupSelection,
  useStore,
  type Tool,
  type View,
} from "../store/store";
import { SNAP_OPTIONS } from "../lib/units";
import type { Unit } from "../types";
import { openProject, pickImportFiles, saveProject } from "./files";
import { OPS } from "./ops";
import { TOOL_COLOR } from "./theme";
import { APP_NAME, AUTHOR } from "./brand";
import { Logo } from "./Logo";
import { MODE_COLOR, MODE_NAME } from "./Overlays";
import { AXIS_COLOR, viewAxis } from "../lib/planes";
import { setLang, t, useLang } from "../i18n";

/** EN | DE switch (top bar and welcome screen) */
export function LangToggle() {
  const lang = useLang((s) => s.lang);
  return (
    <div className="flex items-center gap-1.5 text-ink-400" title={t("Language")}>
      <Languages size={15} />
      <div className="seg">
        {(["en", "de"] as const).map((l) => (
          <button key={l} className={l === lang ? "on" : ""} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TopBar() {
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const unit = useStore((s) => s.doc.settings.unit);
  const snap = useStore((s) => s.doc.settings.snap);
  const opts = SNAP_OPTIONS[unit];
  return (
    <header className="h-12 shrink-0 flex items-center gap-2 px-3 bg-ink-900 border-b border-ink-750">
      <button
        className="brand flex items-center gap-2 pr-3 mr-1 border-r border-ink-750"
        title={t("About {app}", { app: APP_NAME })}
        onClick={() => useStore.setState({ aboutOpen: true })}
      >
        <Logo size={22} />
        <span className="font-semibold tracking-tight text-[14px]">{APP_NAME}</span>
        <span className="text-[11px] text-ink-500 font-normal">by {AUTHOR}</span>
      </button>
      <button className="btn ghost" title={t("Open a project file (.json) as a new project (Ctrl+O)")} onClick={openProject}>
        <FolderOpen size={16} /> {t("Open")}
      </button>
      <button className="btn ghost" title={t("Download the project as a file (Ctrl+S). The browser saves automatically anyway")} onClick={saveProject}>
        <Save size={16} /> {t("Save")}
      </button>
      <button className="btn ghost" title={t("Import STEP, STL, 3MF or OBJ (or drag a file into the window)")} onClick={pickImportFiles}>
        <FileUp size={16} /> {t("Import")}
      </button>
      <div className="w-px h-6 bg-ink-750 mx-1" />
      <button className="btn ghost" disabled={!canUndo} title={t("Undo (Ctrl+Z)")} onClick={undo}>
        <Undo2 size={16} />
      </button>
      <button className="btn ghost" disabled={!canRedo} title={t("Redo (Ctrl+Shift+Z)")} onClick={redo}>
        <Redo2 size={16} />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2 text-ink-400">
        <LangToggle />
        <div className="w-px h-6 bg-ink-750 mx-1" />
        <span className="text-[11px] uppercase tracking-wider">{t("Unit")}</span>
        <div className="seg">
          {(["mm", "cm", "in"] as Unit[]).map((u) => (
            <button key={u} className={u === unit ? "on" : ""} onClick={() => setUnit(u)}>
              {u === "in" ? t("in") : u}
            </button>
          ))}
        </div>
        <span className="text-[11px] uppercase tracking-wider ml-2">{t("Grid")}</span>
        <select
          className="h-7 rounded-md bg-ink-900 border border-ink-700 px-2 outline-none focus:border-accent"
          value={opts.find((o) => Math.abs(o.mm - snap) < 1e-9)?.mm ?? snap}
          onChange={(e) => setSettings({ snap: Number(e.target.value) })}
        >
          {opts.map((o) => (
            <option key={o.label} value={o.mm}>
              {o.label}
            </option>
          ))}
          {!opts.some((o) => Math.abs(o.mm - snap) < 1e-9) && <option value={snap}>{snap} mm</option>}
        </select>
      </div>
      <div className="w-px h-6 bg-ink-750 mx-1" />
      <button className="btn ghost" title={t("Help & shortcuts (?)")} onClick={() => useStore.setState({ helpOpen: true })}>
        <CircleHelp size={16} />
      </button>
      <button className="btn primary" onClick={() => useStore.setState({ exportOpen: true })}>
        <Download size={16} /> {t("Export")}
      </button>
    </header>
  );
}

function ToolButton({
  icon,
  label,
  kbd,
  on,
  color,
  dim,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  kbd?: string;
  on?: boolean;
  /** colour of the tool's kind (see theme.ts) */
  color?: string;
  /** not applicable right now */
  dim?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`tool-btn ${on ? "on" : ""} ${dim ? "dim" : ""}`}
      style={color ? ({ "--tc": color } as React.CSSProperties) : undefined}
      onClick={onClick}
      aria-label={label}
      data-tip={kbd ? `${label} (${kbd})` : label}
    >
      {icon}
    </button>
  );
}

function RailLabel({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div className="rail-label" style={{ color }}>
      {children}
    </div>
  );
}

export function ToolRail() {
  const tool = useStore((s) => s.tool);
  const selCount = useStore((s) => s.selection.filter((id) => s.doc.bodies.some((b) => b.id === id)).length);
  const hasGroup = useStore((s) => s.doc.bodies.some((b) => s.selection.includes(b.id) && b.shape.kind === "group"));
  const pick = (id: Tool) => () => setTool(tool === id && id !== "select" ? "select" : id);
  const prim = (kind: Parameters<typeof addPrimitive>[0]) => (e: React.MouseEvent) => addPrimitive(kind, e.shiftKey);
  return (
    <nav className="tool-rail w-[86px] shrink-0 bg-ink-900 border-r border-ink-750 py-2 px-[5px] overflow-y-auto overflow-x-visible scroll-thin">
      <ToolButton icon={<MousePointer2 size={19} />} label={t("Select & Move")} kbd="V" color={TOOL_COLOR.select} on={tool === "select"} onClick={pick("select")} />
      <RailLabel color={TOOL_COLOR.sketch}>{t("Sketch")}</RailLabel>
      <ToolButton icon={<Square size={19} />} label={t("Rectangle")} kbd="R" color={TOOL_COLOR.sketch} on={tool === "rect"} onClick={pick("rect")} />
      <ToolButton icon={<Circle size={19} />} label={t("Circle")} kbd="C" color={TOOL_COLOR.sketch} on={tool === "circle"} onClick={pick("circle")} />
      <ToolButton icon={<Hexagon size={19} />} label={t("Polygon / polyline")} kbd="P" color={TOOL_COLOR.sketch} on={tool === "poly"} onClick={pick("poly")} />
      <RailLabel color={TOOL_COLOR.body}>{t("Bodies")}</RailLabel>
      <ToolButton icon={<Box size={19} />} label={t("Box (Shift: as hole)")} color={TOOL_COLOR.body} onClick={prim("box")} />
      <ToolButton icon={<Cylinder size={19} />} label={t("Cylinder (Shift: as hole)")} color={TOOL_COLOR.body} onClick={prim("cylinder")} />
      <ToolButton icon={<TriangleRight size={19} />} label={t("Wedge (Shift: as hole)")} color={TOOL_COLOR.body} onClick={prim("wedge")} />
      <ToolButton icon={<Cone size={19} />} label={t("Cone (Shift: as hole)")} color={TOOL_COLOR.body} onClick={prim("cone")} />
      <ToolButton icon={<Globe size={19} />} label={t("Sphere (Shift: as hole)")} color={TOOL_COLOR.body} onClick={prim("sphere")} />
      <ToolButton icon={<CircleDot size={19} />} label={t("Tube (Shift: as hole)")} color={TOOL_COLOR.body} onClick={prim("tube")} />
      <RailLabel color={TOOL_COLOR.edit}>{t("Edit")}</RailLabel>
      <ToolButton
        icon={<SquareRoundCorner size={19} />}
        label={t("Edges & Faces: fillet or chamfer edges, push or tilt faces (or double-click a body)")}
        kbd="F"
        color={TOOL_COLOR.edit}
        on={tool === "edit"}
        onClick={pick("edit")}
      />
      <ToolButton icon={<ArrowDownToLine size={19} />} label={t("Lay a face flat on the print bed")} kbd="L" color={TOOL_COLOR.layflat} on={tool === "layflat"} onClick={pick("layflat")} />
      <RailLabel color={TOOL_COLOR.union}>{t("Combine")}</RailLabel>
      {OPS.filter((o) => o.op !== "group").map((o) => (
        <ToolButton
          key={o.op}
          icon={o.icon(19)}
          label={`${t(o.label)}: ${t(o.tip)}${selCount >= 2 ? "" : `. ${t("Select several bodies first (Shift+click)")}`}`}
          kbd={o.kbd && t(o.kbd)}
          color={TOOL_COLOR[o.op]}
          dim={selCount < 2}
          onClick={() => combineSelection(o.op)}
        />
      ))}
      <ToolButton
        icon={<Ungroup size={19} />}
        label={t("Split: break a combined body back into its parts")}
        kbd={t("Ctrl ⇧ G")}
        color={TOOL_COLOR.ungroup}
        dim={!hasGroup}
        onClick={ungroupSelection}
      />
    </nav>
  );
}

export const VIEWS: { id: View; label: string; kbd: string }[] = [
  { id: "iso", label: "3D", kbd: "1" },
  { id: "top", label: "Top", kbd: "2" },
  { id: "bottom", label: "Bottom", kbd: "7" },
  { id: "front", label: "Front", kbd: "3" },
  { id: "back", label: "Back", kbd: "4" },
  { id: "left", label: "Left", kbd: "5" },
  { id: "right", label: "Right", kbd: "6" },
];

/** each 2D view in the colour of the axis it looks along; 3D stays neutral */
function viewStyle(v: View): React.CSSProperties {
  const axis = viewAxis(v);
  if (axis === null) return { "--vc": "#d5d9e2", "--vc-on": "#121419", "--vc-hover": "#e6e8ed" } as React.CSSProperties;
  return { "--vc": AXIS_COLOR[axis], "--vc-on": "#ffffff", "--vc-hover": AXIS_COLOR[axis] } as React.CSSProperties;
}

export function ViewSwitcher() {
  const view = useStore((s) => s.view);
  const flashNonce = useStore((s) => s.viewFlash);
  const [flashedView, setFlashedView] = useState<View | null>(null);
  useEffect(() => {
    if (!flashNonce) return;
    setFlashedView(useStore.getState().view);
    const t = setTimeout(() => setFlashedView(null), 2200);
    return () => clearTimeout(t);
  }, [flashNonce]);
  const flash = flashedView !== null && flashedView === view;
  return (
    <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
      <div className="seg view-seg overlay-card !rounded-[9px] !p-[3px]" onMouseLeave={() => useStore.setState({ viewHover: null })}>
        {VIEWS.map((v) => (
          <button
            key={`${v.id}-${v.id === view && flash ? flashNonce : 0}`}
            className={`${view === v.id ? "on" : ""} ${v.id === view && flash ? "view-flash" : ""}`}
            style={viewStyle(v.id)}
            title={t("{view} view ({key})", { view: t(v.label), key: v.kbd })}
            onMouseEnter={() => useStore.setState({ viewHover: v.id })}
            onClick={() => setView(v.id)}
          >
            {t(v.label)}
          </button>
        ))}
      </div>
      <button className="btn overlay-card !h-[32px]" title={t("Fit all (0)")} onClick={fitView}>
        <Scan size={15} />
      </button>
    </div>
  );
}

export function StatusBar() {
  const tool = useStore((s) => s.tool);
  const ready = useMeshes((s) => s.ready);
  const busy = useMeshes((s) => s.busy);
  const selection = useStore((s) => s.selection.length);
  const edgeSel = useStore((s) => s.edgeSel);
  const faceSel = useStore((s) => s.faceSel);
  const hints: Record<Tool, string> = {
    select: selection
      ? "Drag: move (snaps to faces) · Double-click or F: Edges & Faces · Alt: free · Arrow keys: nudge · Del: delete"
      : "Click a body to select it · Shift+click: multi-select · Hold right mouse: orbit · Middle mouse: pan · Wheel: zoom",
    rect: "Click & drag (or click twice) for a rectangle · Alt: no grid · Esc: cancel",
    circle: "Click & drag for a circle · Alt: no grid · Esc: cancel",
    poly: "Click to place points · Shift: 15° steps · Click the start point / Enter: close · Backspace: remove last point",
    edit: edgeSel
      ? "Drag the arrow out: fillet · drag it in: chamfer · Shift+click: more edges · Enter: apply · Esc: clear selection"
      : faceSel
        ? "Drag the green arrow: offset the face · Tilt: pick an edge, then add or remove a wedge · Enter: apply · Esc: clear selection"
        : "Hover over edges (yellow) or faces (blue) and click · Tip: union touching parts first (Ctrl+G), then the joints can be filleted",
    layflat: "Click a flat face: the part is rotated so that it lies flat on the print bed",
  };
  // tick while busy so the elapsed time and the cancel button show up
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const stalled = busy ? stalledFor() : 0;
  return (
    <footer className="h-7 shrink-0 flex items-center gap-3 px-3 text-[11.5px] text-ink-400 bg-ink-900 border-t border-ink-750">
      <span className="flex items-center gap-1.5 shrink-0 font-medium" style={{ color: MODE_COLOR[tool] ?? TOOL_COLOR.select }}>
        <span className="w-2 h-2 rounded-full" style={{ background: MODE_COLOR[tool] ?? TOOL_COLOR.select }} />
        {t(MODE_NAME[tool] ?? "")}
      </span>
      <span className="truncate flex-1">{t(hints[tool])}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className={`w-2 h-2 rounded-full ${!ready ? "bg-amber-400 animate-pulse" : busy ? "bg-sky-400 animate-pulse" : "bg-emerald-500"}`} />
        {!ready ? t("Loading CAD kernel…") : busy ? `${t("Calculating…")}${stalled > 3000 ? ` ${Math.round(stalled / 1000)} s` : ""}` : t("Ready")}
        {busy > 0 && stalled > 4000 && (
          <button
            className="ml-1 px-2 h-5 rounded bg-red-600/80 hover:bg-red-600 text-white text-[11px]"
            title={t("Cancel the calculation (the CAD kernel restarts)")}
            onClick={() => {
              cancelWork();
              toast(t("Calculation canceled"));
            }}
          >
            {t("Cancel")}
          </button>
        )}
      </span>
    </footer>
  );
}
