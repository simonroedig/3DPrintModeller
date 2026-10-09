import { useState, type ReactNode } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  Box,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Combine,
  Cone,
  Copy,
  Cylinder,
  Eye,
  EyeOff,
  Globe,
  Hexagon,
  Layers,
  RotateCcw,
  RotateCw,
  Square,
  SquareRoundCorner,
  Trash2,
  TriangleAlert,
  TriangleRight,
  Ungroup,
} from "lucide-react";
import type { Body, Shape, ShapeKind, Sketch, SketchShape, Vec2 } from "../types";
import {
  alignSelection,
  deleteSelection,
  dropToBed,
  duplicateSelection,
  extrudeSketch,
  groupSelection,
  KIND_LABEL,
  removeFeature,
  rotateSelection,
  select,
  setBodyEuler,
  setBodyShape,
  setSelectionMin,
  setSettings,
  setTool,
  ungroupSelection,
  updateBody,
  updateFeature,
  updateSketch,
  useStore,
} from "../store/store";
import { eulerDeg, polyBounds, polygonArea, unionBox } from "../lib/geom";
import { geometryKey } from "../cad/key";
import { useMeshes } from "../cad/client";
import { fmtLen, SNAP_OPTIONS } from "../lib/units";
import { LenField, NumField, Seg } from "./fields";

const ICON: Record<ShapeKind, ReactNode> = {
  box: <Box size={14} />,
  wedge: <TriangleRight size={14} />,
  cylinder: <Cylinder size={14} />,
  cone: <Cone size={14} />,
  sphere: <Globe size={14} />,
  tube: <CircleDot size={14} />,
  prism: <Hexagon size={14} />,
  group: <Layers size={14} />,
};

const SKETCH_ICON: Record<SketchShape["kind"], ReactNode> = {
  rect: <Square size={14} />,
  circle: <Circle size={14} />,
  poly: <Hexagon size={14} />,
};

export function Sidebar() {
  return (
    <aside className="w-[318px] shrink-0 bg-ink-900 border-l border-ink-750 flex flex-col min-h-0">
      <SceneTree />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        <Properties />
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function SceneTree() {
  const bodies = useStore((s) => s.doc.bodies);
  const sketches = useStore((s) => s.doc.sketches);
  const selection = useStore((s) => s.selection);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const click = (id: string) => (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) select(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
    else select([id]);
  };
  const empty = !bodies.length && !sketches.length;
  return (
    <div className="max-h-[38%] min-h-[110px] flex flex-col border-b border-ink-750">
      <div className="panel-title px-3.5 pt-3 !mb-1.5">
        <span>Objekte</span>
        <span className="normal-case tracking-normal text-ink-500">{bodies.length + sketches.length}</span>
      </div>
      <div className="overflow-y-auto scroll-thin px-1.5 pb-2">
        {empty && <div className="text-ink-500 px-2 py-3 text-[12px]">Noch nichts da – zeichne eine Skizze oder füge einen Körper ein.</div>}
        {bodies.map((b) => (
          <div key={b.id}>
            <div
              className={`group flex items-center gap-1.5 h-7 px-2 rounded-md cursor-pointer ${selection.includes(b.id) ? "bg-accent/20 text-white" : "hover:bg-ink-800 text-ink-200"}`}
              onClick={click(b.id)}
            >
              {b.shape.kind === "group" ? (
                <button
                  className="text-ink-400 -ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen({ ...open, [b.id]: !open[b.id] });
                  }}
                >
                  {open[b.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              ) : null}
              <span className="shrink-0" style={{ color: b.hole ? "#94a3b8" : b.color }}>
                {ICON[b.shape.kind]}
              </span>
              <span className={`truncate flex-1 ${b.hidden ? "opacity-40" : ""}`}>{b.name}</span>
              {b.features.length > 0 && <SquareRoundCorner size={12} className="text-ink-500" />}
              {b.hole && <span className="text-[10px] px-1.5 rounded bg-ink-700 text-ink-300">Loch</span>}
              <button
                className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-white"
                title={b.hidden ? "Einblenden" : "Ausblenden"}
                onClick={(e) => {
                  e.stopPropagation();
                  updateBody(b.id, { hidden: !b.hidden });
                }}
              >
                {b.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            {b.shape.kind === "group" && open[b.id] && (
              <div className="ml-5 border-l border-ink-750 pl-1.5">
                {b.shape.children.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 h-6 px-2 text-ink-400 text-[12px]">
                    <span style={{ color: c.hole ? "#94a3b8" : c.color }}>{ICON[c.shape.kind]}</span>
                    <span className="truncate">{c.name}</span>
                    {c.hole && <span className="text-[10px] px-1 rounded bg-ink-750">Loch</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {sketches.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-1.5 h-7 px-2 rounded-md cursor-pointer ${selection.includes(s.id) ? "bg-sky-500/20 text-white" : "hover:bg-ink-800 text-ink-200"}`}
            onClick={click(s.id)}
          >
            <span className="text-sky-400">{SKETCH_ICON[s.shape.kind]}</span>
            <span className="truncate flex-1">{s.name}</span>
            <span className="text-[10px] px-1.5 rounded bg-sky-900/50 text-sky-300">Skizze</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="panel-section">
      <div className="panel-title">
        <span>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5">{children}</div>;
}

function Properties() {
  const selection = useStore((s) => s.selection);
  const allBodies = useStore((s) => s.doc.bodies);
  const bodies = allBodies.filter((b) => selection.includes(b.id));
  const sketch = useStore((s) => s.doc.sketches.find((k) => s.selection.length === 1 && k.id === s.selection[0]));
  if (sketch) return <SketchProps sketch={sketch} />;
  if (bodies.length === 1) return <BodyProps body={bodies[0]} />;
  if (bodies.length > 1) return <MultiProps bodies={bodies} />;
  if (selection.length) return null;
  return <DocProps />;
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      key={value}
      className="w-full bg-transparent text-[15px] font-semibold outline-none border-b border-transparent focus:border-accent pb-0.5"
      defaultValue={value}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={(e) => {
        const v = e.currentTarget.value.trim();
        if (v && v !== value) onChange(v);
      }}
    />
  );
}

const COLORS = ["#4f8ff7", "#f5a524", "#22c55e", "#ef4444", "#a855f7", "#14b8a6", "#e5e7eb", "#475569"];

function BodyProps({ body }: { body: Body }) {
  const entry = useMeshes((s) => s.meshes[geometryKey(body)]);
  useStore((s) => s.doc); // refresh box after mesh updates
  const box = unionBox([body]);
  const euler = eulerDeg(body.quaternion);
  const warnings = [...(entry?.mesh?.warnings ?? []), ...(entry?.error ? [`Geometriefehler: ${entry.error}`] : [])];
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="flex items-center gap-2 text-ink-400 text-[11px] mb-1">
          <span style={{ color: body.hole ? "#94a3b8" : body.color }}>{ICON[body.shape.kind]}</span>
          {KIND_LABEL[body.shape.kind]}
          {body.shape.kind === "group" && ` · ${body.shape.children.length} Teile`}
        </div>
        <NameField value={body.name} onChange={(name) => updateBody(body.id, { name })} />
        <div className="flex items-center gap-2 mt-3">
          <Seg
            value={body.hole ? "hole" : "solid"}
            onChange={(v) => updateBody(body.id, { hole: v === "hole" })}
            options={[
              { value: "solid", label: "Volumen", title: "Normaler, gedruckter Körper" },
              { value: "hole", label: "Loch", title: "Wird beim Vereinen/Export abgezogen" },
            ]}
          />
          {!body.hole && (
            <div className="flex flex-wrap gap-1 ml-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-3.5 h-3.5 rounded-full border-2 ${c === body.color ? "border-white" : "border-transparent"}`}
                  style={{ background: c }}
                  onClick={() => updateBody(body.id, { color: c })}
                />
              ))}
            </div>
          )}
        </div>
        {warnings.map((w, i) => (
          <div key={i} className="mt-2.5 flex gap-2 text-amber-300 text-[12px] bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
            <TriangleAlert size={14} className="shrink-0 mt-0.5" /> {w}
          </div>
        ))}
      </div>

      <Section title="Maße">
        <ShapeParams body={body} />
      </Section>

      <Section
        title="Position"
        right={
          <button className="btn ghost !h-6 !px-1.5 normal-case tracking-normal text-[11px]" title="Unterkante auf Z = 0" onClick={dropToBed}>
            <ArrowDownToLine size={13} /> Aufs Bett
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="X" mm={box.min.x} onChange={(v) => setSelectionMin(0, v)} title="Linke Kante (Bounding Box)" />
          <LenField label="Y" mm={box.min.y} onChange={(v) => setSelectionMin(1, v)} title="Vordere Kante (Bounding Box)" />
          <LenField label="Z" mm={box.min.z} onChange={(v) => setSelectionMin(2, v)} title="Unterkante (Bounding Box)" />
        </div>
        <div className="text-[11px] text-ink-500 mt-1.5">
          Größe gesamt: {fmtLen(box.max.x - box.min.x, useStore.getState().doc.settings.unit)} ×{" "}
          {fmtLen(box.max.y - box.min.y, useStore.getState().doc.settings.unit)} × {fmtLen(box.max.z - box.min.z, useStore.getState().doc.settings.unit)}
        </div>
      </Section>

      <Section title="Drehung">
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <NumField label="X" value={euler[0]} suffix="°" step={15} onChange={(v) => setBodyEuler(body.id, [v, euler[1], euler[2]])} />
          <NumField label="Y" value={euler[1]} suffix="°" step={15} onChange={(v) => setBodyEuler(body.id, [euler[0], v, euler[2]])} />
          <NumField label="Z" value={euler[2]} suffix="°" step={15} onChange={(v) => setBodyEuler(body.id, [euler[0], euler[1], v])} />
        </div>
        <RotateButtons />
        <button className="btn w-full mt-2" onClick={() => setTool("layflat")}>
          <ArrowDownToLine size={14} /> Fläche aufs Bett legen…
        </button>
      </Section>

      <Section
        title="Rundungen & Fasen"
        right={
          <button className="btn ghost !h-6 !px-1.5 normal-case tracking-normal text-[11px]" onClick={() => setTool("fillet")}>
            <SquareRoundCorner size={13} /> Kanten wählen
          </button>
        }
      >
        {body.features.length === 0 ? (
          <div className="text-ink-500 text-[12px]">
            Noch keine. Wähle das Werkzeug <kbd>F</kbd>, klicke Kanten an und zieh am Pfeil.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {body.features.map((f, i) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <span className="text-ink-400 text-[12px] w-[92px] truncate">
                  {i + 1}. {f.type === "fillet" ? "Rundung" : "Fase"} · {f.edges.length}
                </span>
                <div className="flex-1">
                  <LenField label={f.type === "fillet" ? "R" : "D"} mm={f.radius} min={0.01} onChange={(v) => updateFeature(body.id, f.id, { radius: v })} />
                </div>
                <button className="btn ghost danger !px-1.5" title="Entfernen" onClick={() => removeFeature(body.id, f.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Aktionen">
        <div className="grid grid-cols-2 gap-1.5">
          <button className="btn" onClick={duplicateSelection}>
            <Copy size={14} /> Duplizieren
          </button>
          <button className="btn danger" onClick={deleteSelection}>
            <Trash2 size={14} /> Löschen
          </button>
          {body.shape.kind === "group" && (
            <button className="btn col-span-2" onClick={ungroupSelection}>
              <Ungroup size={14} /> Gruppe trennen
            </button>
          )}
        </div>
      </Section>
    </>
  );
}

function RotateButtons() {
  const axes = ["X", "Y", "Z"] as const;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {axes.map((a, i) => (
        <div key={a} className="flex">
          <button className="btn flex-1 !rounded-r-none !px-1" title={`-90° um ${a}`} onClick={() => rotateSelection(i as 0 | 1 | 2, -90)}>
            <RotateCcw size={13} />
          </button>
          <span className="w-6 grid place-items-center bg-ink-900 border-y border-ink-700 text-[11px] text-ink-300">{a}</span>
          <button className="btn flex-1 !rounded-l-none !px-1" title={`+90° um ${a}`} onClick={() => rotateSelection(i as 0 | 1 | 2, 90)}>
            <RotateCw size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ShapeParams({ body }: { body: Body }) {
  const s = body.shape;
  const set = (shape: Shape) => setBodyShape(body.id, shape);
  const min = 0.05;
  switch (s.kind) {
    case "box":
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="B" title="Breite (X)" mm={s.w} min={min} onChange={(w) => set({ ...s, w })} />
          <LenField label="T" title="Tiefe (Y)" mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
          <LenField label="H" title="Höhe (Z)" mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </div>
      );
    case "wedge": {
      const angle = (Math.atan2(s.h, s.d) * 180) / Math.PI;
      return (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <LenField label="B" title="Breite (X)" mm={s.w} min={min} onChange={(w) => set({ ...s, w })} />
            <LenField label="T" title="Tiefe / Länge der Rampe (Y)" mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
            <LenField label="H" title="Höhe am hohen Ende (Z)" mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            <NumField
              label="Winkel"
              value={angle}
              suffix="°"
              step={1}
              min={0.1}
              max={89.9}
              onChange={(a) => set({ ...s, h: Math.round(s.d * Math.tan((a * Math.PI) / 180) * 1000) / 1000 })}
            />
            <div className="text-[11px] text-ink-500 self-center leading-tight">Winkel ändert die Höhe, Tiefe bleibt</div>
          </div>
        </>
      );
    }
    case "cylinder":
      return (
        <Grid2>
          <LenField label="Ø" title="Durchmesser" mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
          <LenField label="H" title="Höhe" mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </Grid2>
      );
    case "cone":
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="Ø↓" title="Durchmesser unten" mm={s.d1} min={0} onChange={(d1) => set({ ...s, d1 })} />
          <LenField label="Ø↑" title="Durchmesser oben" mm={s.d2} min={0} onChange={(d2) => set({ ...s, d2 })} />
          <LenField label="H" title="Höhe" mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </div>
      );
    case "sphere":
      return (
        <Grid2>
          <LenField label="Ø" title="Durchmesser" mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
        </Grid2>
      );
    case "tube":
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="Ø" title="Außendurchmesser" mm={s.d} min={min} onChange={(d) => set({ ...s, d, t: Math.min(s.t, d / 2 - 0.01) })} />
          <LenField label="W" title="Wandstärke" mm={s.t} min={0.05} onChange={(t) => set({ ...s, t: Math.min(t, s.d / 2 - 0.01) })} />
          <LenField label="H" title="Höhe" mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </div>
      );
    case "prism": {
      const pb = polyBounds(s.points);
      const scale = (axis: 0 | 1, size: number) => {
        const cur = axis === 0 ? pb.maxX - pb.minX : pb.maxY - pb.minY;
        const f = size / cur;
        set({
          ...s,
          points: s.points.map(([x, y]) => (axis === 0 ? [pb.minX + (x - pb.minX) * f, y] : [x, pb.minY + (y - pb.minY) * f]) as Vec2),
        });
      };
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="B" mm={pb.maxX - pb.minX} min={min} onChange={(v) => scale(0, v)} />
          <LenField label="T" mm={pb.maxY - pb.minY} min={min} onChange={(v) => scale(1, v)} />
          <LenField label="H" mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </div>
      );
    }
    case "group":
      return (
        <div className="text-ink-400 text-[12px]">
          Vereinte Gruppe aus {s.children.length} Teilen. Zum Ändern der Einzelmaße <b>trennen</b>, anpassen und erneut vereinen.
        </div>
      );
  }
}

function MultiProps({ bodies }: { bodies: Body[] }) {
  useStore((s) => s.doc);
  const box = unionBox(bodies);
  const unit = useStore((s) => s.doc.settings.unit);
  const AlignRow = ({ axis, label, icons }: { axis: 0 | 1 | 2; label: string; icons: ReactNode[] }) => (
    <div className="flex items-center gap-1.5">
      <span className="w-4 text-ink-400 text-[11px]">{label}</span>
      {(["min", "center", "max"] as const).map((m, i) => (
        <button key={m} className="btn flex-1" title={`${label}: ${m === "min" ? "Anfang" : m === "center" ? "Mitte" : "Ende"} bündig`} onClick={() => alignSelection(axis, m)}>
          {icons[i]}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="text-[15px] font-semibold">{bodies.length} Körper ausgewählt</div>
        <div className="text-[11px] text-ink-500 mt-0.5">
          {fmtLen(box.max.x - box.min.x, unit)} × {fmtLen(box.max.y - box.min.y, unit)} × {fmtLen(box.max.z - box.min.z, unit)}
        </div>
        <button className="btn primary w-full mt-3 !h-9" onClick={groupSelection}>
          <Combine size={16} /> Vereinen <span className="opacity-60 text-[11px]">Strg+G</span>
        </button>
        <div className="text-[11px] text-ink-500 mt-1.5">Vereint alle Teile zu einem Körper; Löcher werden abgezogen. Danach lassen sich auch die Übergangskanten runden.</div>
      </div>
      <Section title="Ausrichten">
        <div className="flex flex-col gap-1.5">
          <AlignRow axis={0} label="X" icons={[<AlignStartVertical size={14} />, <AlignCenterVertical size={14} />, <AlignEndVertical size={14} />]} />
          <AlignRow axis={1} label="Y" icons={[<AlignEndHorizontal size={14} />, <AlignCenterHorizontal size={14} />, <AlignStartHorizontal size={14} />]} />
          <AlignRow axis={2} label="Z" icons={[<AlignEndHorizontal size={14} />, <AlignCenterHorizontal size={14} />, <AlignStartHorizontal size={14} />]} />
        </div>
      </Section>
      <Section title="Position (gemeinsam)">
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="X" mm={box.min.x} onChange={(v) => setSelectionMin(0, v)} />
          <LenField label="Y" mm={box.min.y} onChange={(v) => setSelectionMin(1, v)} />
          <LenField label="Z" mm={box.min.z} onChange={(v) => setSelectionMin(2, v)} />
        </div>
        <button className="btn w-full mt-2" onClick={dropToBed}>
          <ArrowDownToLine size={14} /> Alle aufs Bett
        </button>
      </Section>
      <Section title="Drehen (gemeinsam)">
        <RotateButtons />
      </Section>
      <Section title="Aktionen">
        <div className="grid grid-cols-2 gap-1.5">
          <button className="btn" onClick={duplicateSelection}>
            <Copy size={14} /> Duplizieren
          </button>
          <button className="btn danger" onClick={deleteSelection}>
            <Trash2 size={14} /> Löschen
          </button>
        </div>
      </Section>
    </>
  );
}

function SketchProps({ sketch }: { sketch: Sketch }) {
  const [height, setHeight] = useState(10);
  const s = sketch.shape;
  const upd = (shape: SketchShape) => updateSketch(sketch.id, shape);
  const unit = useStore((st) => st.doc.settings.unit);
  const view = useStore((st) => st.view);
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="flex items-center gap-2 text-sky-400 text-[11px] mb-1">
          {SKETCH_ICON[s.kind]} Skizze · {s.kind === "rect" ? "Rechteck" : s.kind === "circle" ? "Kreis" : "Polygon"}
        </div>
        <div className="text-[15px] font-semibold">{sketch.name}</div>
      </div>
      <Section title="Maße">
        {s.kind === "rect" && (
          <>
            <Grid2>
              <LenField label="Breite" mm={s.w} min={0.05} onChange={(w) => upd({ ...s, w })} />
              <LenField label="Tiefe" mm={s.d} min={0.05} onChange={(d) => upd({ ...s, d })} />
              <LenField label="X" mm={s.x} onChange={(x) => upd({ ...s, x })} title="Linke Kante" />
              <LenField label="Y" mm={s.y} onChange={(y) => upd({ ...s, y })} title="Vordere Kante" />
            </Grid2>
            <div className="text-[11px] text-ink-500 mt-1.5">
              Mitte: {fmtLen(s.x + s.w / 2, unit)} / {fmtLen(s.y + s.d / 2, unit)}
            </div>
          </>
        )}
        {s.kind === "circle" && (
          <Grid2>
            <LenField label="Ø" mm={s.d} min={0.05} onChange={(d) => upd({ ...s, d })} />
            <div />
            <LenField label="Mitte X" mm={s.cx} onChange={(cx) => upd({ ...s, cx })} />
            <LenField label="Mitte Y" mm={s.cy} onChange={(cy) => upd({ ...s, cy })} />
          </Grid2>
        )}
        {s.kind === "poly" && (
          <div className="text-ink-300 text-[12px]">
            {s.points.length} Punkte · Fläche {fmtLen(Math.abs(polygonArea(s.points)), unit).replace(/ (\w+)$/, " $1²")}
          </div>
        )}
        <div className="mt-1.5">
          <LenField label="Ebene Z" mm={sketch.z} onChange={(z) => updateSketch(sketch.id, s, z)} />
        </div>
      </Section>
      <Section title="Extrudieren → 3D">
        <LenField label="Höhe" mm={height} onChange={setHeight} />
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <button className="btn primary" onClick={() => extrudeSketch(sketch.id, height)}>
            Extrudieren
          </button>
          <button className="btn" onClick={() => extrudeSketch(sketch.id, height, true)}>
            Als Loch
          </button>
        </div>
        <div className="text-[11px] text-ink-500 mt-2">
          {view === "top" ? "Tipp: In der 3D-Ansicht kannst du auch am grünen Pfeil ziehen." : "Oder am grünen Pfeil in der Ansicht ziehen."} Negative Höhe extrudiert nach unten.
        </div>
      </Section>
      <Section title="Aktionen">
        <button className="btn danger w-full" onClick={deleteSelection}>
          <Trash2 size={14} /> Skizze löschen
        </button>
      </Section>
    </>
  );
}

const BEDS = [
  { label: "Bambu X1/P1/A1", x: 256, y: 256 },
  { label: "Bambu A1 mini", x: 180, y: 180 },
  { label: "Prusa MK4/MK3", x: 250, y: 210 },
  { label: "Prusa Mini", x: 180, y: 180 },
  { label: "Ender 3", x: 220, y: 220 },
  { label: "Voron 350", x: 350, y: 350 },
];

function DocProps() {
  const settings = useStore((s) => s.doc.settings);
  const count = useStore((s) => s.doc.bodies.length);
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="text-[15px] font-semibold">Projekt</div>
        <div className="text-[12px] text-ink-500">{count} Körper · nichts ausgewählt</div>
      </div>
      <Section title="Raster & Einheit">
        <div className="flex flex-wrap gap-1.5">
          {SNAP_OPTIONS[settings.unit].map((o) => (
            <button key={o.label} className={`btn !h-7 ${Math.abs(o.mm - settings.snap) < 1e-9 ? "primary" : ""}`} onClick={() => setSettings({ snap: o.mm })}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-ink-500 mt-2">Alles rastet auf dieses Raster. Beim Ziehen <kbd>Alt</kbd> halten für freie Werte.</div>
      </Section>
      <Section title="Druckbett">
        <Grid2>
          <LenField label="X" mm={settings.bed.x} min={10} onChange={(x) => setSettings({ bed: { ...settings.bed, x } })} />
          <LenField label="Y" mm={settings.bed.y} min={10} onChange={(y) => setSettings({ bed: { ...settings.bed, y } })} />
        </Grid2>
        <div className="flex flex-wrap gap-1 mt-2">
          {BEDS.map((b) => (
            <button key={b.label} className="btn !h-6 !px-2 text-[11px]" onClick={() => setSettings({ bed: { x: b.x, y: b.y } })}>
              {b.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="So geht's">
        <ol className="text-[12px] text-ink-300 list-decimal pl-4 space-y-1.5">
          <li>
            Skizze zeichnen (<kbd>R</kbd>/<kbd>C</kbd>/<kbd>P</kbd>) – Maße direkt im Panel oder am Label anpassen.
          </li>
          <li>Extrudieren: Höhe eingeben oder am grünen Pfeil ziehen.</li>
          <li>Teile aneinander ziehen – sie rasten an Flächen ein (pinke Linien).</li>
          <li>
            Mehrere wählen und vereinen (<kbd>Strg</kbd>+<kbd>G</kbd>).
          </li>
          <li>
            Kanten runden (<kbd>F</kbd>): Kante klicken, Pfeil ziehen.
          </li>
          <li>Exportieren als 3MF oder STL.</li>
        </ol>
      </Section>
    </>
  );
}
