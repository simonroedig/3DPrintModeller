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
import { t } from "../i18n";

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
          label={`${t("Extrude")} · ${fmtLen(height, unit)}`}
          color={TOOL_COLOR.sketch}
          tip={t("Pull the sketch up into a body. Set the height in the panel on the right or with the arrow in the model")}
          onClick={() => extrudeSketch(sketch.id, height)}
        />
        <CtxButton icon={<SquareDashed size={16} />} label={t("As hole")} color={TOOL_COLOR.subtract} tip={t("Extrude as a hole (subtracted on union)")} onClick={() => extrudeSketch(sketch.id, height, true)} />
        <Sep />
        <CtxButton icon={<Trash2 size={16} />} tip={t("Delete")} kbd={t("Del")} color="#f87171" onClick={deleteSelection} />
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
            label={t("Edges & Faces")}
            kbd="F"
            color={TOOL_COLOR.edit}
            tip={t("Fillet or chamfer edges, push or tilt faces (or double-click the body)")}
            onClick={() => setTool("edit")}
          />
        )}
        <CtxButton icon={<ArrowDownToLine size={16} />} label={t("btn|Lay flat")} kbd="L" color={TOOL_COLOR.layflat} tip={t("Click a face that should rest on the bed")} onClick={() => setTool("layflat")} />
        <CtxButton icon={<RotateCw size={16} />} kbd="E" tip={t("Rotate 90° around the vertical axis")} color={TOOL_COLOR.select} onClick={() => rotateSelection(2, -90)} />
        <CtxButton icon={<LocateFixed size={16} />} kbd="M" tip={t("Center on the print bed (on the grid), Shift+M: exact")} color={TOOL_COLOR.select} onClick={() => centerOnBed(false)} />
        {!mesh && (
          <CtxButton
            icon={<Layers2 size={16} />}
            label={b.hole ? t("Solid") : t("Hole")}
            kbd="H"
            color={b.hole ? TOOL_COLOR.body : TOOL_COLOR.subtract}
            tip={b.hole ? t("Make it a normal body again") : t("Make it a hole, subtracted on union")}
            onClick={() => updateBodies({ [b.id]: { hole: !b.hole } })}
          />
        )}
        <Sep />
        <CtxButton icon={<Copy size={16} />} tip={t("Duplicate")} kbd={t("Ctrl D")} onClick={duplicateSelection} />
        <CtxButton icon={<Trash2 size={16} />} tip={t("Delete")} kbd={t("Del")} color="#f87171" onClick={deleteSelection} />
      </>
    );
  } else if (sel.length > 1) {
    content = (
      <>
        {OPS.map((o) => (
          <CtxButton key={o.op} icon={o.icon(16)} label={t(o.label)} kbd={o.kbd && t(o.kbd)} color={TOOL_COLOR[o.op]} tip={t(o.tip)} onClick={() => combineSelection(o.op)} />
        ))}
        <Sep />
        <CtxButton icon={<LocateFixed size={16} />} kbd="M" tip={t("Center all together on the print bed (on the grid), Shift+M: exact")} color={TOOL_COLOR.select} onClick={() => centerOnBed(false)} />
        <CtxButton icon={<Copy size={16} />} tip={t("Duplicate")} kbd={t("Ctrl D")} onClick={duplicateSelection} />
        <CtxButton icon={<Trash2 size={16} />} tip={t("Delete")} kbd={t("Del")} color="#f87171" onClick={deleteSelection} />
      </>
    );
  }
  if (!content) return null;
  return <div className="context-bar absolute bottom-4 left-1/2 -translate-x-1/2 z-10 overlay-card flex items-center gap-1 p-1">{content}</div>;
}
