import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  Box,
  Circle,
  CircleDot,
  CircleHelp,
  Combine,
  Cone,
  Cylinder,
  Download,
  FilePlus2,
  FolderOpen,
  Globe,
  Hexagon,
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
import { useMeshes } from "../cad/client";
import {
  addPrimitive,
  fitView,
  groupSelection,
  redo,
  setSettings,
  setTool,
  setUnit,
  setView,
  undo,
  ungroupSelection,
  useStore,
  type Tool,
  type View,
} from "../store/store";
import { SNAP_OPTIONS } from "../lib/units";
import type { Unit } from "../types";
import { openProject, saveProject } from "./files";

export function TopBar() {
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const unit = useStore((s) => s.doc.settings.unit);
  const snap = useStore((s) => s.doc.settings.snap);
  const opts = SNAP_OPTIONS[unit];
  return (
    <header className="h-12 shrink-0 flex items-center gap-2 px-3 bg-ink-900 border-b border-ink-750">
      <div className="flex items-center gap-2 pr-3 mr-1 border-r border-ink-750">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
          <path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="#3b82f6" />
          <path d="M16 3 28 9.5 16 16 4 9.5z" fill="#93c5fd" />
          <path d="M16 16v13L4 22.5v-13z" fill="#1d4ed8" />
        </svg>
        <span className="font-semibold tracking-tight text-[14px]">PrintModeller</span>
      </div>
      <button className="btn ghost" title="Neues Projekt" onClick={() => useStore.setState({ startDialog: true })}>
        <FilePlus2 size={16} /> Neu
      </button>
      <button className="btn ghost" title="Projekt öffnen (Strg+O)" onClick={openProject}>
        <FolderOpen size={16} /> Öffnen
      </button>
      <button className="btn ghost" title="Projekt speichern (Strg+S)" onClick={saveProject}>
        <Save size={16} /> Speichern
      </button>
      <div className="w-px h-6 bg-ink-750 mx-1" />
      <button className="btn ghost" disabled={!canUndo} title="Rückgängig (Strg+Z)" onClick={undo}>
        <Undo2 size={16} />
      </button>
      <button className="btn ghost" disabled={!canRedo} title="Wiederholen (Strg+Shift+Z)" onClick={redo}>
        <Redo2 size={16} />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2 text-ink-400">
        <span className="text-[11px] uppercase tracking-wider">Einheit</span>
        <div className="seg">
          {(["mm", "cm", "in"] as Unit[]).map((u) => (
            <button key={u} className={u === unit ? "on" : ""} onClick={() => setUnit(u)}>
              {u === "in" ? "Zoll" : u}
            </button>
          ))}
        </div>
        <span className="text-[11px] uppercase tracking-wider ml-2">Raster</span>
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
      <button className="btn ghost" title="Hilfe & Tastenkürzel (?)" onClick={() => useStore.setState({ helpOpen: true })}>
        <CircleHelp size={16} />
      </button>
      <button className="btn primary" onClick={() => useStore.setState({ exportOpen: true })}>
        <Download size={16} /> Exportieren
      </button>
    </header>
  );
}

function ToolButton({ icon, label, kbd, on, onClick }: { icon: ReactNode; label: string; kbd?: string; on?: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button className={`tool-btn ${on ? "on" : ""}`} onClick={onClick} aria-label={label}>
      {icon}
      <span className="tip">
        {label}
        {kbd && <kbd>{kbd}</kbd>}
      </span>
    </button>
  );
}

function RailLabel({ children }: { children: ReactNode }) {
  return <div className="text-[9px] uppercase tracking-[0.12em] text-ink-500 mt-3 mb-1 text-center">{children}</div>;
}

export function ToolRail() {
  const tool = useStore((s) => s.tool);
  const selCount = useStore((s) => s.selection.filter((id) => s.doc.bodies.some((b) => b.id === id)).length);
  const hasGroup = useStore((s) => s.doc.bodies.some((b) => s.selection.includes(b.id) && b.shape.kind === "group"));
  const t = (id: Tool) => () => setTool(tool === id && id !== "select" ? "select" : id);
  const prim = (kind: Parameters<typeof addPrimitive>[0]) => (e: React.MouseEvent) => addPrimitive(kind, e.shiftKey);
  return (
    <nav className="w-[58px] shrink-0 bg-ink-900 border-r border-ink-750 flex flex-col items-center py-2 gap-1 overflow-y-auto overflow-x-visible scroll-thin">
      <ToolButton icon={<MousePointer2 size={19} />} label="Auswählen & Verschieben" kbd="V" on={tool === "select"} onClick={t("select")} />
      <RailLabel>Skizze</RailLabel>
      <ToolButton icon={<Square size={19} />} label="Rechteck" kbd="R" on={tool === "rect"} onClick={t("rect")} />
      <ToolButton icon={<Circle size={19} />} label="Kreis" kbd="C" on={tool === "circle"} onClick={t("circle")} />
      <ToolButton icon={<Hexagon size={19} />} label="Polygon / Linienzug" kbd="P" on={tool === "poly"} onClick={t("poly")} />
      <RailLabel>Körper</RailLabel>
      <ToolButton icon={<Box size={19} />} label="Quader  (Shift: als Loch)" onClick={prim("box")} />
      <ToolButton icon={<Cylinder size={19} />} label="Zylinder  (Shift: als Loch)" onClick={prim("cylinder")} />
      <ToolButton icon={<TriangleRight size={19} />} label="Keil  (Shift: als Loch)" onClick={prim("wedge")} />
      <ToolButton icon={<Cone size={19} />} label="Kegel  (Shift: als Loch)" onClick={prim("cone")} />
      <ToolButton icon={<Globe size={19} />} label="Kugel  (Shift: als Loch)" onClick={prim("sphere")} />
      <ToolButton icon={<CircleDot size={19} />} label="Rohr  (Shift: als Loch)" onClick={prim("tube")} />
      <RailLabel>Ändern</RailLabel>
      <ToolButton icon={<SquareRoundCorner size={19} />} label="Kanten runden / fasen" kbd="F" on={tool === "fillet"} onClick={t("fillet")} />
      <ToolButton icon={<ArrowDownToLine size={19} />} label="Fläche aufs Druckbett legen" kbd="L" on={tool === "layflat"} onClick={t("layflat")} />
      <ToolButton
        icon={<Combine size={19} className={selCount >= 2 ? "" : "opacity-40"} />}
        label="Vereinen (Gruppieren)"
        kbd="Strg G"
        onClick={groupSelection}
      />
      <ToolButton icon={<Ungroup size={19} className={hasGroup ? "" : "opacity-40"} />} label="Gruppe trennen" kbd="Strg ⇧ G" onClick={ungroupSelection} />
    </nav>
  );
}

const VIEWS: { id: View; label: string; kbd: string }[] = [
  { id: "iso", label: "3D", kbd: "1" },
  { id: "top", label: "Oben", kbd: "2" },
  { id: "front", label: "Vorne", kbd: "3" },
  { id: "right", label: "Rechts", kbd: "4" },
];

export function ViewSwitcher() {
  const view = useStore((s) => s.view);
  return (
    <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
      <div className="seg accent overlay-card !rounded-[9px] !p-[3px]">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? "on" : ""} title={`${v.label}-Ansicht (${v.kbd})`} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      <button className="btn overlay-card !h-[32px]" title="Alles einpassen (0)" onClick={fitView}>
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
  const hints: Record<Tool, string> = {
    select: selection
      ? "Ziehen: verschieben (rastet an Flächen ein) · Alt: frei · Pfeiltasten: nudgen · Strg+D: duplizieren · Entf: löschen"
      : "Klicke einen Körper zum Auswählen · Shift+Klick: Mehrfachauswahl · Rechte Maus halten: drehen · Mittlere Maus: verschieben · Rad: zoomen",
    rect: "Klicken & ziehen (oder zwei Klicks) für ein Rechteck · Alt: ohne Raster · Esc: abbrechen",
    circle: "Klicken & ziehen für einen Kreis · Alt: ohne Raster · Esc: abbrechen",
    poly: "Klicken setzt Punkte · Shift: 15°-Schritte · Klick auf Startpunkt / Enter: schließen · Backspace: letzter Punkt zurück",
    fillet: edgeSel
      ? "Pfeil ziehen oder Radius eingeben · Shift+Klick: weitere Kanten · Enter: anwenden · Esc: abbrechen"
      : "Klicke eine Kante · Tipp: berührende Teile erst vereinen (Strg+G), dann lassen sich auch die Übergänge runden",
    layflat: "Klicke eine ebene Fläche – das Teil wird so gedreht, dass sie flach auf dem Druckbett liegt",
  };
  return (
    <footer className="h-7 shrink-0 flex items-center gap-3 px-3 text-[11.5px] text-ink-400 bg-ink-900 border-t border-ink-750">
      <span className="truncate flex-1">{hints[tool]}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className={`w-2 h-2 rounded-full ${!ready ? "bg-amber-400 animate-pulse" : busy ? "bg-sky-400 animate-pulse" : "bg-emerald-500"}`} />
        {!ready ? "CAD-Kern lädt…" : busy ? "Berechne…" : "Bereit"}
      </span>
    </footer>
  );
}
