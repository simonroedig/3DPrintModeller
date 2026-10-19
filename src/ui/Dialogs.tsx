import { useState, type ReactNode } from "react";
import { Download, LoaderCircle, X } from "lucide-react";
import type { ExportFormat, ExportQuality, Unit } from "../types";
import { useStore } from "../store/store";
import { createEmptyProject, createExampleProject, useProjects } from "../store/projects";
import { Logo } from "./Logo";
import { Pitch } from "./About";
import { exportModel } from "../cad/client";
import { DEFAULT_SNAP, SNAP_OPTIONS } from "../lib/units";
import { download } from "./files";

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
          <button className="btn ghost absolute right-3 top-3 !px-1.5 z-10" title="Schließen (Esc)" onClick={onClose}>
            <X size={16} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

const UNITS: { unit: Unit; title: string; sub: string }[] = [
  { unit: "mm", title: "Millimeter", sub: "Präzise Teile · Raster 1 mm" },
  { unit: "cm", title: "Zentimeter", sub: "Größere Teile · Raster 1 cm" },
  { unit: "in", title: "Zoll", sub: "Imperial · Raster 1/16″" },
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
          <div className="text-[18px] font-semibold">{firstVisit ? "Los geht's" : "Neues Projekt"}</div>
          <div className="text-ink-400 text-[12.5px]">{firstVisit ? "Lege dein erstes Projekt an." : "Das aktuelle Projekt bleibt gespeichert."}</div>
        </div>
      </div>
      <div className="text-ink-300 mt-5 mb-2 text-[12.5px]">In welcher Einheit arbeitest du?</div>
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
            <div className="text-[12.5px] text-ink-200">{u.title}</div>
            <div className="text-[11px] text-ink-500 mt-0.5">{u.sub}</div>
          </button>
        ))}
      </div>
      <div className="text-ink-300 mt-4 mb-2 text-[12.5px]">Raster (alles rastet darauf ein)</div>
      <div className="flex flex-wrap gap-1.5">
        {SNAP_OPTIONS[unit].map((o) => (
          <button key={o.label} className={`btn ${Math.abs(o.mm - snap) < 1e-9 ? "primary" : ""}`} onClick={() => setSnap(o.mm)}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-6">
        <button className="btn primary !h-9 !px-4" onClick={() => createEmptyProject(unit, snap)}>
          Leeres Projekt starten
        </button>
        <button className="btn !h-9" onClick={() => createExampleProject(unit)} title="Zwei Keile + Steg als Lautsprecher-Ständer">
          Beispiel: Lautsprecher-Keil
        </button>
        <div className="flex-1" />
        {hasDoc && (
          <button className="btn ghost !h-9" onClick={close}>
            Abbrechen
          </button>
        )}
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
  { id: "3mf", title: "3MF", sub: "Empfohlen · Bambu, Prusa, Orca, Cura" },
  { id: "stl", title: "STL", sub: "Universell, jeder Slicer" },
  { id: "step", title: "STEP", sub: "Exakte CAD-Geometrie (Fusion, FreeCAD …)" },
];

const QUALITIES: { id: ExportQuality; title: string; sub: string }[] = [
  { id: "normal", title: "Normal", sub: "0,02 mm Abweichung" },
  { id: "high", title: "Hoch", sub: "0,008 mm · glatte Rundungen" },
  { id: "ultra", title: "Ultra", sub: "0,003 mm · große Dateien" },
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
  const [name, setName] = useState("modell");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ volume: number; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const list = onlySel && selectedBodies.length ? selectedBodies : bodies;
    if (!list.some((b) => !b.hole && !b.hidden)) {
      setError("Es gibt keinen sichtbaren Volumenkörper zum Exportieren.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { data, volume } = await exportModel(list, format, quality, separate && format !== "step");
      const mime = format === "3mf" ? "model/3mf" : format === "stl" ? "model/stl" : "model/step";
      download(data, `${name || "modell"}.${format}`, mime);
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
      <div className="text-[18px] font-semibold mb-1">Exportieren</div>
      <div className="text-ink-400 text-[12.5px] mb-4">Sich berührende Teile werden vereint, Löcher automatisch abgezogen.</div>
      <div className="grid grid-cols-3 gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            className={`text-left rounded-lg border p-3 ${format === f.id ? "border-accent bg-accent/15" : "border-ink-700 bg-ink-900 hover:border-ink-500"}`}
            onClick={() => setFormat(f.id)}
          >
            <div className="font-semibold text-[15px]">{f.title}</div>
            <div className="text-[11px] text-ink-400 mt-0.5 leading-snug">{f.sub}</div>
          </button>
        ))}
      </div>
      {format !== "step" && (
        <>
          <div className="text-ink-300 mt-4 mb-2 text-[12.5px]">Qualität (Tessellierung)</div>
          <div className="grid grid-cols-3 gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                className={`text-left rounded-lg border px-3 py-2 ${quality === q.id ? "border-accent bg-accent/15" : "border-ink-700 bg-ink-900 hover:border-ink-500"}`}
                onClick={() => setQuality(q.id)}
              >
                <div className="font-medium">{q.title}</div>
                <div className="text-[11px] text-ink-400">{q.sub}</div>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-col gap-2 mt-4 text-[12.5px] text-ink-200">
        <label className={`flex items-center gap-2 ${selectedBodies.length ? "" : "opacity-40"}`}>
          <input type="checkbox" disabled={!selectedBodies.length} checked={onlySel && selectedBodies.length > 0} onChange={(e) => setOnlySel(e.target.checked)} />
          Nur Auswahl exportieren ({selectedBodies.length})
        </label>
        {format !== "step" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
            Jeden Körper als eigenes Objekt (z. B. für unterschiedliche Farben)
          </label>
        )}
      </div>
      <div className="flex items-center gap-2 mt-5">
        <div className="field flex-1 !h-9">
          <span className="lbl">Dateiname</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
          <span className="unit">.{format}</span>
        </div>
        <button className="btn primary !h-9 !px-4" disabled={busy} onClick={run}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />} Exportieren
        </button>
      </div>
      {error && <div className="mt-3 text-red-300 text-[12.5px]">{error}</div>}
      {result && (
        <div className="mt-3 text-[12.5px] text-emerald-300">
          Fertig · Volumen {cm3.toFixed(1).replace(".", ",")} cm³ ≈ {(cm3 * 1.24).toFixed(0)} g PLA (100 % Infill) · Datei{" "}
          {(result.size / 1024).toFixed(0)} KB
        </div>
      )}
    </Modal>
  );
}

const KEYS: [string, string][] = [
  ["V", "Auswählen & Verschieben"],
  ["R / C / P", "Rechteck / Kreis / Polygon skizzieren, in der Ebene der aktuellen Ansicht (3D = Boden)"],
  ["F", "Kanten & Flächen bearbeiten (auch Doppelklick auf einen Körper)"],
  ["L", "Fläche aufs Druckbett legen"],
  ["1 bis 7", "3D / Oben / Vorne / Hinten / Links / Rechts / Unten"],
  ["Leertaste", "Zwischen Oben und 3D wechseln"],
  ["0", "Alles einpassen"],
  ["Strg + G", "Vereinen (Abziehen, Schnittmenge, Gruppieren: linke Leiste / Panel)"],
  ["Strg + Shift + G", "Kombinierten Körper trennen"],
  ["Strg + D", "Duplizieren"],
  ["Strg + C / V", "Kopieren / Einfügen"],
  ["Strg + Z / Strg + Shift + Z", "Rückgängig / Wiederholen"],
  ["Entf / Backspace", "Auswahl löschen"],
  ["Pfeiltasten", "Auswahl um 1 Rasterschritt verschieben (Shift: ×10)"],
  ["Bild ↑ / Bild ↓", "Auswahl in Z verschieben"],
  ["Q / E", "Auswahl um 90° um Z drehen"],
  ["M / Shift + M", "Auswahl (ohne Auswahl: alles) mittig aufs Bett, im Raster / exakt"],
  ["H", "Auswahl zwischen Volumen und Loch umschalten"],
  ["Alt beim Ziehen", "Raster & Einrasten aus"],
  ["Shift beim Ziehen", "Griffe vereinter Körper: proportional skalieren"],
  ["Zahlenfeld ziehen", "Zahl per Links/Rechts-Ziehen ändern (Shift ×10, Alt ×0,1), Klick zum Tippen"],
  ["Esc", "Abbrechen / Werkzeug beenden / Auswahl aufheben"],
  ["Strg + S / Strg + O", "Projektdatei herunterladen / als neues Projekt öffnen (nimmt auch STEP/STL/3MF/OBJ)"],
  ["Datei ins Fenster ziehen", "STEP, STL, 3MF oder OBJ importieren"],
];

export function HelpDialog() {
  return (
    <Modal onClose={() => useStore.setState({ helpOpen: false })} width={600}>
      <div className="text-[18px] font-semibold mb-3">Tastenkürzel & Bedienung</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
        {KEYS.map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-right">
              {k.split(" / ").map((x, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-ink-500"> / </span>}
                  <kbd className="!ml-0">{x}</kbd>
                </span>
              ))}
            </div>
            <div className="text-ink-300">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-[12px] text-ink-400 leading-relaxed">
        Maus: Linke Taste auswählen, ziehen und zeichnen · Rechte Taste halten drehen (aus einer 2D-Ansicht geht es dabei in 3D weiter) ·
        Mittlere Taste verschieben · Rad zoomen. Die Skizzenebene stellst du oben rechts ein (ziehen, eintippen oder auf eine Fläche
        klicken). Zahlenfelder verstehen Rechnungen wie <code>120/2</code> oder <code>2cm+5</code>. Alle Projekte werden automatisch im
        Browser gespeichert. Unten in der Projektleiste kannst du wechseln, anlegen, umbenennen (Doppelklick), kopieren oder löschen.
      </div>
    </Modal>
  );
}
