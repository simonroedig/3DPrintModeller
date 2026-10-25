import { useState, type ReactNode } from "react";
import { Download, LoaderCircle, Smartphone, Speaker, X } from "lucide-react";
import type { ExportFormat, ExportQuality, Unit } from "../types";
import { useStore } from "../store/store";
import { createEmptyProject, createExampleProject, createPhoneStandProject, useProjects } from "../store/projects";
import { Logo } from "./Logo";
import { LangToggle } from "./Chrome";
import { Pitch } from "./About";
import { exportModel } from "../cad/client";
import { DEFAULT_SNAP, SNAP_OPTIONS } from "../lib/units";
import { download } from "./files";
import { locale, t, tMsg, tn } from "../i18n";

function Modal({ children, onClose, width = 520, bare = false }: { children: ReactNode; onClose?: () => void; width?: number; bare?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`overlay-card !bg-ink-850 relative ${bare ? "overflow-hidden" : "p-6"} max-h-[calc(100vh-32px)] overflow-y-auto`}
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      >
        {onClose && (
          <button className="btn ghost absolute right-3 top-3 !px-1.5 z-10" title={t("Close (Esc)")} onClick={onClose}>
            <X size={16} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

const UNITS: { unit: Unit; title: string; sub: string }[] = [
  { unit: "mm", title: "Millimeter", sub: "Precise parts · 1 mm grid" },
  { unit: "cm", title: "Centimeter", sub: "Larger parts · 1 cm grid" },
  { unit: "in", title: "Inch", sub: "Imperial · 1/16″ grid" },
];

export function StartDialog() {
  const hasDoc = useStore((s) => s.doc.bodies.length > 0 || s.doc.sketches.length > 0);
  const current = useStore((s) => s.doc.settings.unit);
  // first visit (no project yet): introduce 3DPrintModeller next to the start options
  const firstVisit = useProjects((s) => s.ready && s.list.length === 0);
  const [unit, setUnit] = useState<Unit>(current);
  const [snap, setSnap] = useState<number>(DEFAULT_SNAP[current]);
  const close = () => useStore.setState({ startDialog: false });
  const options = (
    <>
      <div className="flex items-center gap-3 mb-1">
        {!firstVisit && <Logo size={30} />}
        <div>
          <div className="text-[18px] font-semibold">{firstVisit ? t("Let's get started") : t("New project")}</div>
          <div className="text-ink-400 text-[12.5px]">{firstVisit ? t("Create your first project.") : t("Your current project stays saved.")}</div>
        </div>
        {firstVisit && (
          <div className="ml-auto self-start">
            <LangToggle />
          </div>
        )}
      </div>
      <div className="text-ink-300 mt-5 mb-2 text-[12.5px]">{t("Which unit do you work in?")}</div>
      <div className="grid grid-cols-3 gap-2">
        {UNITS.map((u) => (
          <button
            key={u.unit}
            className={`text-left rounded-lg border p-3 transition ${unit === u.unit ? "border-accent bg-accent/15" : "border-ink-700 bg-ink-900 hover:border-ink-500"}`}
            onClick={() => {
              setUnit(u.unit);
              setSnap(DEFAULT_SNAP[u.unit]);
            }}
          >
            <div className="text-[20px] font-semibold">{u.unit === "in" ? "in" : u.unit}</div>
            <div className="text-[12.5px] text-ink-200">{t(u.title)}</div>
            <div className="text-[11px] text-ink-500 mt-0.5">{t(u.sub)}</div>
          </button>
        ))}
      </div>
      <div className="text-ink-300 mt-4 mb-2 text-[12.5px]">{t("Grid (everything snaps to it)")}</div>
      <div className="flex flex-wrap gap-1.5">
        {SNAP_OPTIONS[unit].map((o) => (
          <button key={o.label} className={`btn ${Math.abs(o.mm - snap) < 1e-9 ? "primary" : ""}`} onClick={() => setSnap(o.mm)}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-6">
        <button className="btn primary !h-9 !px-4" onClick={() => createEmptyProject(unit, snap)}>
          {t("Start an empty project")}
        </button>
        <div className="flex-1" />
        {hasDoc && (
          <button className="btn ghost !h-9" onClick={close}>
            {t("Cancel")}
          </button>
        )}
      </div>
      <div className="text-ink-300 mt-5 mb-2 text-[12.5px]">{t("Or explore an example")}</div>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn !h-9"
          onClick={() => createPhoneStandProject(unit)}
          title={t("Built from a plate, a wedge and a lip, with a cable channel subtracted and the edges rounded. Everything stays editable.")}
        >
          <Smartphone size={15} /> {t("Phone stand")}
        </button>
        <button className="btn !h-9" onClick={() => createExampleProject(unit)} title={t("Two wedges joined by a crossbar, forming a speaker stand")}>
          <Speaker size={15} /> {t("Speaker wedge")}
        </button>
      </div>
    </>
  );
  if (!firstVisit)
    return (
      <Modal onClose={hasDoc ? close : undefined} width={560}>
        {options}
      </Modal>
    );
  return (
    <Modal onClose={hasDoc ? close : undefined} width={980} bare>
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <div className="welcome-pitch p-6 md:border-r border-ink-750">
          <Pitch />
        </div>
        <div className="p-6 flex flex-col">{options}</div>
      </div>
    </Modal>
  );
}

export function AboutDialog() {
  const close = () => useStore.setState({ aboutOpen: false });
  return (
    <Modal onClose={close} width={640} bare>
      <div className="welcome-pitch p-6">
        <Pitch />
      </div>
    </Modal>
  );
}

const FORMATS: { id: ExportFormat; title: string; sub: string }[] = [
  { id: "3mf", title: "3MF", sub: "Recommended · Bambu, Prusa, Orca, Cura" },
  { id: "stl", title: "STL", sub: "Universal, works with every slicer" },
  { id: "step", title: "STEP", sub: "Exact CAD geometry (Fusion, FreeCAD, …)" },
];

const QUALITIES: { id: ExportQuality; title: string; sub: string }[] = [
  { id: "normal", title: "Normal", sub: "0.02 mm deviation" },
  { id: "high", title: "High", sub: "0.008 mm · smooth curves" },
  { id: "ultra", title: "Ultra", sub: "0.003 mm · large files" },
];

export function ExportDialog() {
  const bodies = useStore((s) => s.doc.bodies);
  const selection = useStore((s) => s.selection);
  const close = () => useStore.setState({ exportOpen: false });
  const [format, setFormat] = useState<ExportFormat>("3mf");
  const [quality, setQuality] = useState<ExportQuality>("high");
  const selectedBodies = bodies.filter((b) => selection.includes(b.id));
  const [onlySel, setOnlySel] = useState(selectedBodies.length > 0);
  const [separate, setSeparate] = useState(false);
  const [name, setName] = useState(t("model"));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ volume: number; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const list = onlySel && selectedBodies.length ? selectedBodies : bodies;
    if (!list.some((b) => !b.hole && !b.hidden)) {
      setError("There is no visible solid to export.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { data, volume } = await exportModel(list, format, quality, separate && format !== "step");
      const mime = format === "3mf" ? "model/3mf" : format === "stl" ? "model/stl" : "model/step";
      download(data, `${name || t("model")}.${format}`, mime);
      setResult({ volume, size: data.byteLength });
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const cm3 = result ? result.volume / 1000 : 0;
  return (
    <Modal onClose={close} width={560}>
      <div className="text-[18px] font-semibold mb-1">{t("Export")}</div>
      <div className="text-ink-400 text-[12.5px] mb-4">{t("Touching parts are merged, holes are subtracted automatically.")}</div>
      <div className="grid grid-cols-3 gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            className={`text-left rounded-lg border p-3 ${format === f.id ? "border-accent bg-accent/15" : "border-ink-700 bg-ink-900 hover:border-ink-500"}`}
            onClick={() => setFormat(f.id)}
          >
            <div className="font-semibold text-[15px]">{f.title}</div>
            <div className="text-[11px] text-ink-400 mt-0.5 leading-snug">{t(f.sub)}</div>
          </button>
        ))}
      </div>
      {format !== "step" && (
        <>
          <div className="text-ink-300 mt-4 mb-2 text-[12.5px]">{t("Quality (tessellation)")}</div>
          <div className="grid grid-cols-3 gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                className={`text-left rounded-lg border px-3 py-2 ${quality === q.id ? "border-accent bg-accent/15" : "border-ink-700 bg-ink-900 hover:border-ink-500"}`}
                onClick={() => setQuality(q.id)}
              >
                <div className="font-medium">{t(q.title)}</div>
                <div className="text-[11px] text-ink-400">{t(q.sub)}</div>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-col gap-2 mt-4 text-[12.5px] text-ink-200">
        <label className={`flex items-center gap-2 ${selectedBodies.length ? "" : "opacity-40"}`}>
          <input type="checkbox" disabled={!selectedBodies.length} checked={onlySel && selectedBodies.length > 0} onChange={(e) => setOnlySel(e.target.checked)} />
          {t("Export selection only ({count})", { count: selectedBodies.length })}
        </label>
        {format !== "step" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
            {t("Each body as a separate object (e.g. for different colors)")}
          </label>
        )}
      </div>
      <div className="flex items-center gap-2 mt-5">
        <div className="field flex-1 !h-9">
          <span className="lbl">{t("File name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          <span className="unit">.{format}</span>
        </div>
        <button className="btn primary !h-9 !px-4" disabled={busy} onClick={run}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />} {t("Export")}
        </button>
      </div>
      {error && <div className="mt-3 text-red-300 text-[12.5px]">{tMsg(error)}</div>}
      {result && (
        <div className="mt-3 text-[12.5px] text-emerald-300">
          {t("Done · Volume {volume} cm³ ≈ {grams} g PLA (100% infill) · File {size} KB", {
            volume: cm3.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            grams: (cm3 * 1.24).toLocaleString(locale(), { maximumFractionDigits: 0 }),
            size: (result.size / 1024).toLocaleString(locale(), { maximumFractionDigits: 0 }),
          })}
        </div>
      )}
    </Modal>
  );
}

const KEYS: [string, string][] = [
  ["V", "Select & move"],
  ["R / C / P", "Sketch a rectangle / circle / line shape in the plane of the current view (3D: ground plane)"],
  ["Line tool: type a number", "Exact length of the next segment, Enter places it (30<45: 30 at 45°)"],
  ["F", "Edit edges & faces (or double-click a body)"],
  ["L", "Lay a face flat on the print bed"],
  ["1 to 7", "3D / Top / Front / Back / Left / Right / Bottom"],
  ["Space", "Switch between top view and 3D"],
  ["0", "Zoom to fit"],
  ["Ctrl + G", "Union (subtract, intersect, group: left toolbar / panel)"],
  ["Ctrl + Shift + G", "Split a combined body"],
  ["Ctrl + D", "Duplicate"],
  ["Ctrl + C / V", "Copy / Paste"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Undo / Redo"],
  ["Del / Backspace", "Delete selection"],
  ["Arrow keys", "Move selection by 1 grid step (Shift: ×10)"],
  ["Page Up / Page Down", "Move selection along Z"],
  ["Q / E", "Rotate selection 90° around Z"],
  ["M / Shift + M", "Center the selection (or everything, if nothing is selected) on the bed, snapped to the grid / exactly"],
  ["H", "Toggle selection between solid and hole"],
  ["Alt while dragging", "Turn off grid & snapping"],
  ["Shift while dragging", "Scale combined bodies proportionally via their handles"],
  ["Drag a number field", "Drag left/right to change the value (Shift ×10, Alt ×0.1), click to type"],
  ["Esc", "Cancel / exit tool / clear selection"],
  ["Ctrl + S / Ctrl + O", "Download project file / open as a new project (also accepts STEP/STL/3MF/OBJ)"],
  ["Drop a file into the window", "Import STEP, STL, 3MF or OBJ"],
];

export function HelpDialog() {
  return (
    <Modal onClose={() => useStore.setState({ helpOpen: false })} width={600}>
      <div className="text-[18px] font-semibold mb-3">{t("Keyboard shortcuts & controls")}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
        {KEYS.map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-right">
              {t(k).split(" / ").map((x, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-ink-500"> / </span>}
                  <kbd className="!ml-0">{x}</kbd>
                </span>
              ))}
            </div>
            <div className="text-ink-300">{t(v)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-[12px] text-ink-400 leading-relaxed">
        {tn(
          "Mouse: left button to select, drag and draw · hold the right button to orbit (from a 2D view, this continues in 3D) · middle button to pan · wheel to zoom. Set the sketch plane at the top right (drag, type a value or click a face). Number fields understand math like {example1} or {example2}. All projects are saved automatically in your browser. In the project bar at the bottom you can switch, create, rename (double-click), duplicate or delete projects.",
          { example1: <code>120/2</code>, example2: <code>2cm+5</code> },
        )}
      </div>
    </Modal>
  );
}
