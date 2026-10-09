import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { geometryKey } from "../cad/key";
import { useMeshes } from "../cad/client";
import { applyFillet, setTool, useStore } from "../store/store";
import { selectAllEdges } from "../viewport/FilletTool";
import { LenField, Seg } from "./fields";

export function ToolOptions() {
  const tool = useStore((s) => s.tool);
  const rectMode = useStore((s) => s.rectMode);
  const circleMode = useStore((s) => s.circleMode);
  const sketchZ = useStore((s) => s.sketchZ);
  if (tool === "select") return null;

  let content: React.ReactNode = null;
  if (tool === "rect" || tool === "circle" || tool === "poly") {
    content = (
      <>
        <span className="font-medium text-ink-200">{tool === "rect" ? "Rechteck" : tool === "circle" ? "Kreis" : "Polygon"}</span>
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
        <div className="w-[150px]">
          <LenField label="Ebene Z" mm={sketchZ} onChange={(v) => useStore.setState({ sketchZ: v })} title="Höhe der Skizzenebene" />
        </div>
      </>
    );
  } else if (tool === "fillet") {
    content = <FilletOptions />;
  } else if (tool === "layflat") {
    content = <span className="text-ink-200">Klicke die Fläche, die unten aufliegen soll</span>;
  }

  return (
    <div className="absolute top-3 left-3 z-10 overlay-card flex items-center gap-3 px-3 py-2 max-w-[calc(100%-330px)] flex-wrap">
      {content}
      <button className="btn ghost !h-6 !px-1.5" title="Werkzeug beenden (Esc)" onClick={() => setTool("select")}>
        <X size={14} />
      </button>
    </div>
  );
}

function FilletOptions() {
  const fillet = useStore((s) => s.fillet);
  const edgeSel = useStore((s) => s.edgeSel);
  const selection = useStore((s) => s.selection);
  const body = useStore((s) => s.doc.bodies.find((b) => b.id === (s.edgeSel?.bodyId ?? s.selection[0])));
  const previewKey =
    body && edgeSel
      ? geometryKey({ shape: body.shape, features: [...body.features, { id: "p", type: fillet.type, radius: fillet.radius, edges: edgeSel.refs }] })
      : null;
  const preview = useMeshes((s) => (previewKey ? s.meshes[previewKey] : undefined));
  const warning = preview?.mesh?.warnings?.length ? "Radius zu groß für diese Kante(n)" : preview?.error;
  const calculating = !!previewKey && fillet.radius > 0 && !preview;
  return (
    <>
      <Seg
        accent
        value={fillet.type}
        onChange={(v) => useStore.setState({ fillet: { ...fillet, type: v } })}
        options={[
          { value: "fillet", label: "Rundung" },
          { value: "chamfer", label: "Fase" },
        ]}
      />
      <div className="w-[130px]">
        <LenField label={fillet.type === "fillet" ? "Radius" : "Abstand"} mm={fillet.radius} min={0} onChange={(v) => useStore.setState({ fillet: { ...fillet, radius: v } })} />
      </div>
      {body && selection.length <= 1 && (
        <button className="btn" onClick={() => selectAllEdges(body.id)} title="Alle Kanten des Körpers auswählen">
          Alle Kanten
        </button>
      )}
      <span className="text-ink-400 text-[12px] min-w-[90px]">
        {edgeSel ? `${edgeSel.idx.length} Kante${edgeSel.idx.length === 1 ? "" : "n"}` : "Kante anklicken"}
      </span>
      {calculating && <LoaderCircle size={15} className="animate-spin text-sky-400" />}
      {warning && (
        <span className="flex items-center gap-1 text-amber-400 text-[12px]">
          <TriangleAlert size={14} /> {warning}
        </span>
      )}
      <button className="btn primary" disabled={!edgeSel || fillet.radius <= 0 || !!warning} onClick={applyFillet}>
        <Check size={15} /> Anwenden
      </button>
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
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
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

export function EmptyHint() {
  const empty = useStore((s) => s.doc.bodies.length === 0 && s.doc.sketches.length === 0);
  const tool = useStore((s) => s.tool);
  if (!empty || tool !== "select") return null;
  return (
    <div className="absolute inset-x-0 top-[38%] flex justify-center pointer-events-none z-0">
      <div className="text-center text-ink-400 max-w-md">
        <div className="text-ink-200 text-[15px] font-medium mb-1.5">Leeres Projekt</div>
        Zeichne eine Skizze mit <kbd>R</kbd> Rechteck oder <kbd>C</kbd> Kreis und extrudiere sie –
        oder füge links direkt einen Körper ein (Quader, Zylinder, Keil …).
      </div>
    </div>
  );
}
