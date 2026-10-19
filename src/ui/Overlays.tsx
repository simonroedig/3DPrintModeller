import { useState } from "react";
import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { geometryKey } from "../cad/key";
import { useMeshes } from "../cad/client";
import { currentSketchPlane, setTool, useStore, type Tool } from "../store/store";
import { fmtLen } from "../lib/units";
import { ORIENT_LABEL, PLANE_AXIS, PLANE_AXIS_NAME } from "../lib/planes";
import { applyEdit, displayGeometry, hasPendingEdit } from "../store/edit";
import { selectAllEdges } from "../viewport/EditTool";
import { LenField, NumField, Seg } from "./fields";
import { TOOL_COLOR } from "./theme";

export const MODE_COLOR: Partial<Record<Tool, string>> = {
  rect: TOOL_COLOR.sketch,
  circle: TOOL_COLOR.sketch,
  poly: TOOL_COLOR.sketch,
  edit: TOOL_COLOR.edit,
  layflat: TOOL_COLOR.layflat,
};

export const MODE_NAME: Partial<Record<Tool, string>> = {
  select: "Auswahl",
  rect: "Skizze · Rechteck",
  circle: "Skizze · Kreis",
  poly: "Skizze · Polygon",
  edit: "Kanten & Flächen",
  layflat: "Aufs Bett legen",
};

/** coloured frame around the viewport so a non-default mode is impossible to miss */
export function ModeFrame() {
  const tool = useStore((s) => s.tool);
  const color = MODE_COLOR[tool];
  if (!color) return null;
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5] mode-frame"
      style={{ boxShadow: `inset 0 0 0 2px ${color}, inset 0 0 28px ${color}33` }}
    />
  );
}

export function ToolOptions() {
  const tool = useStore((s) => s.tool);
  const rectMode = useStore((s) => s.rectMode);
  const circleMode = useStore((s) => s.circleMode);
  useStore((s) => s.sketchPlanes);
  useStore((s) => s.view);
  const plane = currentSketchPlane();
  const unit = useStore((s) => s.doc.settings.unit);
  if (tool === "select") return null;

  let content: React.ReactNode = null;
  if (tool === "rect" || tool === "circle" || tool === "poly") {
    content = (
      <>
        {tool === "rect" && (
          <Seg
            value={rectMode}
            onChange={(v) => useStore.setState({ rectMode: v })}
            options={[
              { value: "corner", label: "Ecke → Ecke", title: "Von einer Ecke zur gegenüberliegenden" },
              { value: "center", label: "Aus der Mitte", title: "Vom Mittelpunkt aus" },
            ]}
          />
        )}
        {tool === "circle" && (
          <Seg
            value={circleMode}
            onChange={(v) => useStore.setState({ circleMode: v })}
            options={[
              { value: "center", label: "Mittelpunkt", title: "Mittelpunkt, dann Radius" },
              { value: "corner", label: "Ecke → Ecke", title: "Wie ein Rechteck aufziehen" },
            ]}
          />
        )}
        {tool === "poly" && <span className="text-ink-300 text-[12px]">Klicken setzt Punkte · Klick auf Start / Enter schließt</span>}
        <span className="text-ink-300 text-[12px]" title="Die Skizze liegt in der Ebene der aktuellen Ansicht (3D = Boden) · Lage oben rechts einstellen">
          Ebene: {ORIENT_LABEL[plane.orient]} · {PLANE_AXIS_NAME[PLANE_AXIS[plane.orient]]} = {fmtLen(plane.value, unit)}
        </span>
      </>
    );
  } else if (tool === "edit") {
    content = <EditOptions />;
  } else if (tool === "layflat") {
    content = <span className="text-ink-200">Klicke die Fläche, die unten aufliegen soll</span>;
  }

  const color = MODE_COLOR[tool] ?? "#3b82f6";
  return (
    <div
      className="absolute top-3 left-3 z-10 overlay-card flex items-center gap-3 pl-1.5 pr-2 py-1.5 max-w-[calc(100%-310px)] flex-wrap"
      style={{ borderColor: `${color}99` }}
    >
      <span className="px-2.5 h-7 grid place-items-center rounded-md font-semibold text-[12px] text-ink-950" style={{ background: color }}>
        {MODE_NAME[tool]}
      </span>
      {content}
      <button className="btn ghost !h-7 !px-1.5" title="Modus verlassen (Esc)" onClick={() => setTool("select")}>
        <X size={15} />
      </button>
    </div>
  );
}

function EditOptions() {
  const fillet = useStore((s) => s.fillet);
  const edgeSel = useStore((s) => s.edgeSel);
  const faceSel = useStore((s) => s.faceSel);
  const faceOp = useStore((s) => s.faceOp);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const bodies = useStore((s) => s.doc.bodies);
  const body = bodies.find((b) => b.id === (edgeSel?.bodyId ?? faceSel?.bodyId ?? selection[0]));
  const previewKey =
    body && (edgeSel || faceSel) ? geometryKey(displayGeometry({ tool, edgeSel, faceSel, fillet, faceOp }, body)) : null;
  const preview = useMeshes((s) => (previewKey ? s.meshes[previewKey] : undefined));
  const pending = !!body && hasPendingEdit();
  const warning = pending ? (preview?.mesh?.warnings?.[preview.mesh.warnings.length - 1] ?? preview?.error) : undefined;
  const calculating = pending && !preview;
  const status = (
    <>
      {calculating && <LoaderCircle size={15} className="animate-spin text-sky-400" />}
      {warning && (
        <span className="flex items-center gap-1 text-amber-400 text-[12px]">
          <TriangleAlert size={14} /> {warning}
        </span>
      )}
    </>
  );
  const apply = (
    <button className="btn primary" disabled={!pending || !!warning} onClick={applyEdit} title="Anwenden (Enter)">
      <Check size={15} /> Anwenden
    </button>
  );

  if (edgeSel) {
    return (
      <>
        <Seg
          accent
          value={fillet.type}
          onChange={(v) => useStore.setState({ fillet: { ...fillet, type: v } })}
          options={[
            { value: "fillet", label: "Rundung", title: "Pfeil nach außen ziehen" },
            { value: "chamfer", label: "Fase", title: "Pfeil nach innen ziehen" },
          ]}
        />
        <div className="w-[130px]">
          <LenField label={fillet.type === "fillet" ? "Radius" : "Abstand"} mm={fillet.radius} min={0} onChange={(v) => useStore.setState({ fillet: { ...fillet, radius: v } })} />
        </div>
        <span className="text-ink-400 text-[12px]">
          {edgeSel.idx.length} Kante{edgeSel.idx.length === 1 ? "" : "n"}
          {fillet.radius === 0 && " · Pfeil ziehen: raus = Rundung, rein = Fase"}
        </span>
        {body && (
          <button className="btn" onClick={() => selectAllEdges(body.id)} title="Alle Kanten des Körpers auswählen">
            Alle Kanten
          </button>
        )}
        {status}
        {apply}
      </>
    );
  }
  if (faceSel) {
    return (
      <>
        <Seg
          accent
          value={faceOp.mode}
          onChange={(v) => useStore.setState({ faceOp: { ...faceOp, mode: v } })}
          options={[
            { value: "push", label: "Verschieben", title: "Fläche nach außen/innen versetzen" },
            { value: "tilt", label: "Neigen", title: "Fläche um eine Kante kippen (Keil dazu/weg)" },
          ]}
        />
        {faceOp.mode === "push" ? (
          <div className="w-[150px]">
            <LenField label="Abstand" mm={faceOp.distance} onChange={(v) => useStore.setState({ faceOp: { ...faceOp, distance: v } })} title="Positiv = nach außen, negativ = nach innen" />
          </div>
        ) : !faceOp.hinge ? (
          <span className="text-[12.5px] text-fuchsia-300 font-medium">→ Klicke die Kante, um die gekippt wird</span>
        ) : (
          <>
            <Seg
              value={faceOp.angle < 0 ? "remove" : "add"}
              onChange={(v) => useStore.setState({ faceOp: { ...faceOp, angle: (v === "add" ? 1 : -1) * Math.abs(faceOp.angle || 10) } })}
              options={[
                { value: "add", label: "Keil dazu", title: "Material hinzufügen" },
                { value: "remove", label: "Keil weg", title: "Material wegnehmen" },
              ]}
            />
            <div className="w-[120px]">
              <NumField
                label="Winkel"
                value={Math.abs(faceOp.angle)}
                suffix="°"
                min={0}
                max={85}
                step={1}
                onChange={(a) => useStore.setState({ faceOp: { ...faceOp, angle: (faceOp.angle < 0 ? -1 : 1) * a } })}
              />
            </div>
            <button className="btn ghost" onClick={() => useStore.setState({ faceOp: { ...faceOp, hinge: null, angle: 0 } })}>
              Andere Kante
            </button>
          </>
        )}
        {status}
        {apply}
      </>
    );
  }
  return (
    <>
      <span className="text-ink-200 text-[12.5px]">Fahre über Kanten oder Flächen und klicke zum Auswählen</span>
      {body && (
        <button className="btn" onClick={() => selectAllEdges(body.id)} title="Alle Kanten des ausgewählten Körpers">
          Alle Kanten
        </button>
      )}
    </>
  );
}

export function DragHud() {
  const info = useStore((s) => s.dragInfo);
  if (!info) return null;
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 overlay-card px-3 py-1.5 text-[12.5px] font-medium tabular-nums text-ink-100 pointer-events-none">
      {info}
    </div>
  );
}

export function KernelLoading() {
  const ready = useMeshes((s) => s.ready);
  if (ready) return null;
  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 overlay-card px-4 py-2 flex items-center gap-2 text-ink-200 pointer-events-none">
      <LoaderCircle size={16} className="animate-spin text-sky-400" /> CAD-Kern (OpenCascade) wird geladen…
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="absolute bottom-[64px] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast overlay-card px-3.5 py-2 text-[12.5px] ${t.kind === "error" ? "!border-red-500/60 text-red-200" : "text-ink-100"}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

const HINT_KEY = "printmodeller.startHint.hidden";

function readHintHidden() {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function EmptyHint() {
  const empty = useStore((s) => s.doc.bodies.length === 0 && s.doc.sketches.length === 0);
  const tool = useStore((s) => s.tool);
  const start = useStore((s) => s.startDialog);
  const [hidden, setHidden] = useState(readHintHidden);
  if (!empty || tool !== "select" || start || hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  };
  const Step = ({ n, color, children }: { n: number; color: string; children: React.ReactNode }) => (
    <li className="flex gap-2 items-start leading-[18px]">
      <span className="step-num" style={{ background: color }}>
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
  return (
    <div className="start-hint absolute left-3 bottom-3 z-[1] pointer-events-none overlay-card px-3.5 py-3 max-w-[310px] text-[12px] text-ink-300">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-ink-100 text-[13px] font-semibold flex-1">Leeres Projekt: so geht's los</span>
        <button className="btn ghost !h-6 !px-1 -mr-1.5 pointer-events-auto" title="Startkarte ausblenden" onClick={close}>
          <X size={14} />
        </button>
      </div>
      <ol className="flex flex-col gap-1.5">
        <Step n={1} color={TOOL_COLOR.sketch}>
          Skizze zeichnen: <kbd className="!ml-0">R</kbd> Rechteck, <kbd className="!ml-0">C</kbd> Kreis, oder links einen Grundkörper einfügen.
        </Step>
        <Step n={2} color={TOOL_COLOR.body}>
          Extrudieren, Maße an den Pfeilen ziehen oder eintippen.
        </Step>
        <Step n={3} color={TOOL_COLOR.edit}>
          Kanten runden mit <kbd className="!ml-0">F</kbd>, Teile kombinieren, als 3MF exportieren.
        </Step>
      </ol>
    </div>
  );
}
