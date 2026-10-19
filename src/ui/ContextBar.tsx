import type { ReactNode } from "react";
import { ArrowDownToLine, Copy, Layers2, LocateFixed, RotateCw, SquareRoundCorner, Trash2, MoveUp, SquareDashed } from "lucide-react";
import {
  centerOnBed,
  combineSelection,
  deleteSelection,
  duplicateSelection,
  extrudeSketch,
  isMeshBody,
  rotateSelection,
  setTool,
  updateBodies,
  useStore,
} from "../store/store";
import { OPS } from "./ops";
import { fmtLen } from "../lib/units";
import { TOOL_COLOR } from "./theme";

function CtxButton({ icon, label, kbd, color, onClick, tip }: { icon: ReactNode; label?: string; kbd?: string; color?: string; tip: string; onClick: () => void }) {
  return (
    <button
      className={`ctx-btn ${label ? "" : "icon-only"}`}
      style={color ? ({ "--tc": color } as React.CSSProperties) : undefined}
      data-tip={kbd ? `${tip} (${kbd})` : tip}
      onClick={onClick}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

const Sep = () => <span className="w-px h-6 bg-ink-700 mx-0.5" />;

/**
 * Floating actions for what is selected, so the next useful steps (rounding edges, combining, …)
 * are right there instead of hidden behind a shortcut.
 */
export function ContextBar() {
  const tool = useStore((s) => s.tool);
  const dragging = useStore((s) => !!s.dragInfo);
  const selection = useStore((s) => s.selection);
  const bodies = useStore((s) => s.doc.bodies);
  const sketches = useStore((s) => s.doc.sketches);
  const height = useStore((s) => s.extrudeHeight);
  const unit = useStore((s) => s.doc.settings.unit);
  if (tool !== "select" || dragging || !selection.length) return null;
  const sel = bodies.filter((b) => selection.includes(b.id));
  const sketch = selection.length === 1 ? sketches.find((k) => k.id === selection[0]) : undefined;

  let content: ReactNode = null;
  if (sketch) {
    content = (
      <>
        <CtxButton
          icon={<MoveUp size={16} />}
          label={`Extrudieren · ${fmtLen(height, unit)}`}
          color={TOOL_COLOR.sketch}
          tip="Skizze zum Körper hochziehen. Höhe im Panel rechts oder am Pfeil im Modell"
          onClick={() => extrudeSketch(sketch.id, height)}
        />
        <CtxButton icon={<SquareDashed size={16} />} label="Als Loch" color={TOOL_COLOR.subtract} tip="Als Loch extrudieren (wird beim Vereinen abgezogen)" onClick={() => extrudeSketch(sketch.id, height, true)} />
        <Sep />
        <CtxButton icon={<Trash2 size={16} />} tip="Löschen" kbd="Entf" color="#f87171" onClick={deleteSelection} />
      </>
    );
  } else if (sel.length === 1) {
    const b = sel[0];
    const mesh = isMeshBody(b);
    content = (
      <>
        {!mesh && (
          <CtxButton
            icon={<SquareRoundCorner size={16} />}
            label="Kanten & Flächen"
            kbd="F"
            color={TOOL_COLOR.edit}
            tip="Kanten runden oder fasen, Flächen verschieben oder neigen (auch Doppelklick auf den Körper)"
            onClick={() => setTool("edit")}
          />
        )}
        <CtxButton icon={<ArrowDownToLine size={16} />} label="Aufs Bett" kbd="L" color={TOOL_COLOR.layflat} tip="Eine Fläche anklicken, die unten aufliegen soll" onClick={() => setTool("layflat")} />
        <CtxButton icon={<RotateCw size={16} />} kbd="E" tip="90° um die Hochachse drehen" color={TOOL_COLOR.select} onClick={() => rotateSelection(2, -90)} />
        <CtxButton icon={<LocateFixed size={16} />} kbd="M" tip="Mittig aufs Druckbett (im Raster), Shift+M: exakt" color={TOOL_COLOR.select} onClick={() => centerOnBed(false)} />
        {!mesh && (
          <CtxButton
            icon={<Layers2 size={16} />}
            label={b.hole ? "Volumen" : "Loch"}
            kbd="H"
            color={b.hole ? TOOL_COLOR.body : TOOL_COLOR.subtract}
            tip={b.hole ? "Wieder zum normalen Körper machen" : "Zum Loch machen, wird beim Vereinen abgezogen"}
            onClick={() => updateBodies({ [b.id]: { hole: !b.hole } })}
          />
        )}
        <Sep />
        <CtxButton icon={<Copy size={16} />} tip="Duplizieren" kbd="Strg D" onClick={duplicateSelection} />
        <CtxButton icon={<Trash2 size={16} />} tip="Löschen" kbd="Entf" color="#f87171" onClick={deleteSelection} />
      </>
    );
  } else if (sel.length > 1) {
    content = (
      <>
        {OPS.map((o) => (
          <CtxButton key={o.op} icon={o.icon(16)} label={o.label} kbd={o.kbd} color={TOOL_COLOR[o.op]} tip={o.tip} onClick={() => combineSelection(o.op)} />
        ))}
        <Sep />
        <CtxButton icon={<LocateFixed size={16} />} kbd="M" tip="Gemeinsam mittig aufs Druckbett (im Raster), Shift+M: exakt" color={TOOL_COLOR.select} onClick={() => centerOnBed(false)} />
        <CtxButton icon={<Copy size={16} />} tip="Duplizieren" kbd="Strg D" onClick={duplicateSelection} />
        <CtxButton icon={<Trash2 size={16} />} tip="Löschen" kbd="Entf" color="#f87171" onClick={deleteSelection} />
      </>
    );
  }
  if (!content) return null;
  return <div className="context-bar absolute bottom-4 left-1/2 -translate-x-1/2 z-10 overlay-card flex items-center gap-1 p-1">{content}</div>;
}
