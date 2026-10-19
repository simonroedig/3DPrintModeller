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
  ChevronUp,
  Circle,
  CircleDot,
  Cone,
  Copy,
  Cylinder,
  Eye,
  EyeOff,
  FileBox,
  Globe,
  Hexagon,
  Layers,
  LocateFixed,
  LogOut,
  RotateCcw,
  RotateCw,
  Square,
  SquareRoundCorner,
  Trash2,
  TriangleAlert,
  TriangleRight,
  Ungroup,
} from "lucide-react";
import type { Body, BoolOp, Shape, ShapeKind, Sketch, SketchShape, TiltFeature, Vec2, Vec3 } from "../types";
import {
  alignSelection,
  deleteSelection,
  dropToBed,
  duplicateSelection,
  extrudeSketch,
  centerOnBed,
  combineSelection,
  extractGroupChild,
  KIND_LABEL,
  OP_NAME,
  setGroupBase,
  setGroupOp,
  updateGroupChild,
  removeFeature,
  rotateSelection,
  select,
  setBodyEuler,
  setBodyShape,
  setSelectionMin,
  setSettings,
  setShowBed,
  setTool,
  ungroupSelection,
  convertMeshAsset,
  isMeshBody,
  updateBody,
  updateFeature,
  updateSketch,
  useStore,
} from "../store/store";
import { bodyMatrix, eulerDeg, localBox, polyBounds, polygonArea, unionBox } from "../lib/geom";
import { scaleGroup, scaleGroupShape } from "../lib/shapeEdit";
import { OPS } from "./ops";
import { TOOL_COLOR } from "./theme";
import { geometryKey } from "../cad/key";
import { assetPayload, useMeshes } from "../cad/client";
import { fmtLen, SNAP_OPTIONS } from "../lib/units";
import { ORIENT_LABEL, PLANE_AXIS, PLANE_AXIS_NAME, viewAxis } from "../lib/planes";
import { LenField, NumField, Seg, Switch } from "./fields";
import { locale, t, tMsg, tn } from "../i18n";

const ICON: Record<ShapeKind, ReactNode> = {
  box: <Box size={14} />,
  wedge: <TriangleRight size={14} />,
  cylinder: <Cylinder size={14} />,
  cone: <Cone size={14} />,
  sphere: <Globe size={14} />,
  tube: <CircleDot size={14} />,
  prism: <Hexagon size={14} />,
  group: <Layers size={14} />,
  imported: <FileBox size={14} />,
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
        <span>{t("Objects")}</span>
        <span className="normal-case tracking-normal text-ink-500">{bodies.length + sketches.length}</span>
      </div>
      <div className="overflow-y-auto scroll-thin px-1.5 pb-2">
        {empty && <div className="text-ink-500 px-2 py-3 text-[12px]">{t("Nothing here yet. Draw a sketch or add a body.")}</div>}
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
              {b.hole && <span className="text-[10px] px-1.5 rounded bg-ink-700 text-ink-300">{t("Hole")}</span>}
              <button
                className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-white"
                title={b.hidden ? t("Show") : t("Hide")}
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
                    {c.hole && <span className="text-[10px] px-1 rounded bg-ink-750">{t("Hole")}</span>}
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
            <span className="text-[10px] px-1.5 rounded bg-sky-900/50 text-sky-300">{t("Sketch")}</span>
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

const FEATURE_NAME = { fillet: "Fillet", chamfer: "Chamfer", push: "Face offset", tilt: "Face tilt" } as const;

const COLORS = ["#4f8ff7", "#f5a524", "#22c55e", "#ef4444", "#a855f7", "#14b8a6", "#e5e7eb", "#475569"];

function BodyProps({ body }: { body: Body }) {
  const entry = useMeshes((s) => s.meshes[geometryKey(body)]);
  useStore((s) => s.doc); // refresh box after mesh updates
  const box = unionBox([body]);
  const euler = eulerDeg(body.quaternion);
  const warnings = [
    ...(entry?.mesh?.warnings ?? []).map((w) => tMsg(w)),
    ...(entry?.error ? [t("Geometry error: {error}", { error: tMsg(entry.error) })] : []),
  ];
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="flex items-center gap-2 text-ink-400 text-[11px] mb-1">
          <span style={{ color: body.hole ? "#94a3b8" : body.color }}>{ICON[body.shape.kind]}</span>
          {body.shape.kind === "group" ? t(`name|${OP_NAME[body.shape.op ?? "union"]}`) : t(KIND_LABEL[body.shape.kind])}
          {body.shape.kind === "group" && ` · ${t("{count} parts", { count: body.shape.children.length })}`}
        </div>
        <NameField value={body.name} onChange={(name) => updateBody(body.id, { name })} />
        <div className="flex items-center gap-2 mt-3">
          <Seg
            value={body.hole ? "hole" : "solid"}
            disabled={isMeshBody(body)}
            onChange={(v) => updateBody(body.id, { hole: v === "hole" })}
            options={[
              { value: "solid", label: t("Solid"), title: t("Normal, printed body") },
              { value: "hole", label: t("Hole"), title: t("Subtracted on union/export") },
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

      <Section title={t("Dimensions")}>
        <ShapeParams body={body} />
      </Section>

      {body.shape.kind === "group" && <GroupParts body={body as GroupBody} />}

      <Section
        title={t("Position")}
        right={
          <button className="btn ghost !h-6 !px-1.5 normal-case tracking-normal text-[11px]" title={t("Bottom to Z = 0")} onClick={dropToBed}>
            <ArrowDownToLine size={13} /> {t("Drop to bed")}
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="X" mm={box.min.x} onChange={(v) => setSelectionMin(0, v)} title={t("Left edge (bounding box)")} />
          <LenField label="Y" mm={box.min.y} onChange={(v) => setSelectionMin(1, v)} title={t("Front edge (bounding box)")} />
          <LenField label="Z" mm={box.min.z} onChange={(v) => setSelectionMin(2, v)} title={t("Bottom edge (bounding box)")} />
        </div>
        <div className="text-[11px] text-ink-500 mt-1.5">
          {t("Overall size: {x} × {y} × {z}", {
            x: fmtLen(box.max.x - box.min.x, useStore.getState().doc.settings.unit),
            y: fmtLen(box.max.y - box.min.y, useStore.getState().doc.settings.unit),
            z: fmtLen(box.max.z - box.min.z, useStore.getState().doc.settings.unit),
          })}
        </div>
        <CenterButtons />
      </Section>

      <Section title={t("Rotation")}>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <NumField label="X" value={euler[0]} suffix="°" step={15} onChange={(v) => setBodyEuler(body.id, [v, euler[1], euler[2]])} />
          <NumField label="Y" value={euler[1]} suffix="°" step={15} onChange={(v) => setBodyEuler(body.id, [euler[0], v, euler[2]])} />
          <NumField label="Z" value={euler[2]} suffix="°" step={15} onChange={(v) => setBodyEuler(body.id, [euler[0], euler[1], v])} />
        </div>
        <RotateButtons />
        <button className="btn w-full mt-2" onClick={() => setTool("layflat")}>
          <ArrowDownToLine size={14} /> {t("Lay a face flat…")}
        </button>
      </Section>

      {!isMeshBody(body) && <Section
        title={t("Edits")}
        right={
          <button className="btn ghost !h-6 !px-1.5 normal-case tracking-normal text-[11px]" style={{ color: TOOL_COLOR.edit }} onClick={() => setTool("edit")}>
            <SquareRoundCorner size={13} /> {t("Edges & Faces")}
          </button>
        }
      >
        {body.features.length === 0 ? (
          <div className="text-ink-500 text-[12px]">
            {tn("None yet. Press {key} (or double-click the body) to fillet or chamfer edges and to move or tilt faces.", { key: <kbd>F</kbd> })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {body.features.map((f, i) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <span className="text-ink-400 text-[12px] w-[104px] shrink-0 truncate" title={t(FEATURE_NAME[f.type])}>
                  {i + 1}. {t(FEATURE_NAME[f.type])}
                  {(f.type === "fillet" || f.type === "chamfer") && ` · ${f.edges.length}`}
                </span>
                <div className="flex-1 min-w-0">
                  {f.type === "fillet" || f.type === "chamfer" ? (
                    <LenField label={f.type === "fillet" ? "R" : "D"} mm={f.radius} min={0.01} onChange={(v) => updateFeature(body.id, f.id, { radius: v })} />
                  ) : f.type === "push" ? (
                    <LenField label="↕" mm={f.distance} onChange={(v) => updateFeature(body.id, f.id, { distance: v })} title={t("Positive = outward, negative = inward")} />
                  ) : (
                    <NumField label="∠" value={(f as TiltFeature).angle} suffix="°" step={1} min={-85} max={85} onChange={(v) => updateFeature(body.id, f.id, { angle: v })} />
                  )}
                </div>
                <button className="btn ghost danger !px-1.5" title={t("Remove")} onClick={() => removeFeature(body.id, f.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>}

      <Section title={t("Actions")}>
        <div className="grid grid-cols-2 gap-1.5">
          <button className="btn" onClick={duplicateSelection}>
            <Copy size={14} /> {t("Duplicate")}
          </button>
          <button className="btn danger" onClick={deleteSelection}>
            <Trash2 size={14} /> {t("Delete")}
          </button>
          {body.shape.kind === "group" && (
            <button className="btn col-span-2" onClick={ungroupSelection}>
              <Ungroup size={14} /> {t("Ungroup")}
            </button>
          )}
        </div>
      </Section>
    </>
  );
}

/** middle of the bed in X/Y: by default in whole grid steps (stays on the grid), or exactly */
function CenterButtons({ label }: { label?: string }) {
  return (
    <div className="flex gap-1.5 mt-2">
      <button
        className="btn flex-1"
        title={t("Center on the print bed (X and Y, the height stays), in whole grid steps so everything stays on the grid (M)")}
        onClick={() => centerOnBed(false)}
      >
        <LocateFixed size={14} /> {label ?? t("Center")}
      </button>
      <button className="btn !px-2.5" title={t("Exactly centered, even if it is then no longer exactly on the grid (Shift+M)")} onClick={() => centerOnBed(true)}>
        {t("exactly")}
      </button>
    </div>
  );
}

function RotateButtons() {
  const axes = ["X", "Y", "Z"] as const;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {axes.map((a, i) => (
        <div key={a} className="flex">
          <button className="btn flex-1 !rounded-r-none !px-1" title={t("-90° around {axis}", { axis: a })} onClick={() => rotateSelection(i as 0 | 1 | 2, -90)}>
            <RotateCcw size={13} />
          </button>
          <span className="w-6 grid place-items-center bg-ink-900 border-y border-ink-700 text-[11px] text-ink-300">{a}</span>
          <button className="btn flex-1 !rounded-l-none !px-1" title={t("+90° around {axis}", { axis: a })} onClick={() => rotateSelection(i as 0 | 1 | 2, 90)}>
            <RotateCw size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ShapeParams({ body, onShape }: { body: Body; onShape?: (shape: Shape) => void }) {
  const s = body.shape;
  const set = onShape ?? ((shape: Shape) => setBodyShape(body.id, shape));
  const min = 0.05;
  switch (s.kind) {
    case "box":
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label={t("W")} title={t("Width (X)")} mm={s.w} min={min} onChange={(w) => set({ ...s, w })} />
          <LenField label={t("D")} title={t("Depth (Y)")} mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
          <LenField label={t("H")} title={t("Height (Z)")} mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </div>
      );
    case "wedge": {
      const angle = (Math.atan2(s.h, s.d) * 180) / Math.PI;
      return (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <LenField label={t("W")} title={t("Width (X)")} mm={s.w} min={min} onChange={(w) => set({ ...s, w })} />
            <LenField label={t("D")} title={t("Depth / ramp length (Y)")} mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
            <LenField label={t("H")} title={t("Height at the high end (Z)")} mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            <NumField
              label={t("Angle")}
              value={angle}
              suffix="°"
              step={1}
              min={0.1}
              max={89.9}
              onChange={(a) => set({ ...s, h: Math.round(s.d * Math.tan((a * Math.PI) / 180) * 1000) / 1000 })}
            />
            <div className="text-[11px] text-ink-500 self-center leading-tight">{t("Angle changes the height, depth stays")}</div>
          </div>
        </>
      );
    }
    case "cylinder":
      return (
        <Grid2>
          <LenField label="Ø" title={t("Diameter")} mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
          <LenField label={t("H")} title={t("Height")} mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </Grid2>
      );
    case "cone":
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="Ø↓" title={t("Bottom diameter")} mm={s.d1} min={0} onChange={(d1) => set({ ...s, d1 })} />
          <LenField label="Ø↑" title={t("Top diameter")} mm={s.d2} min={0} onChange={(d2) => set({ ...s, d2 })} />
          <LenField label={t("H")} title={t("Height")} mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </div>
      );
    case "sphere":
      return (
        <Grid2>
          <LenField label="Ø" title={t("Diameter")} mm={s.d} min={min} onChange={(d) => set({ ...s, d })} />
        </Grid2>
      );
    case "tube":
      return (
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="Ø" title={t("Outer diameter")} mm={s.d} min={min} onChange={(d) => set({ ...s, d, t: Math.min(s.t, d / 2 - 0.01) })} />
          <LenField label={t("Wall")} title={t("Wall thickness")} mm={s.t} min={0.05} onChange={(t) => set({ ...s, t: Math.min(t, s.d / 2 - 0.01) })} />
          <LenField label={t("H")} title={t("Height")} mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
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
          <LenField label={t("W")} mm={pb.maxX - pb.minX} min={min} onChange={(v) => scale(0, v)} />
          <LenField label={t("D")} mm={pb.maxY - pb.minY} min={min} onChange={(v) => scale(1, v)} />
          <LenField label={t("H")} mm={s.h} min={min} onChange={(h) => set({ ...s, h })} />
        </div>
      );
    }
    case "imported": {
      const asset = useStore.getState().doc.assets?.[s.asset];
      const payload = assetPayload(s.asset);
      const tris = payload?.format === "mesh" ? (payload.parts[s.part]?.indices.length ?? 0) / 3 : 0;
      const k = s.scale;
      const dims = [0, 1, 2].map((a) => (s.max[a] - s.min[a]) * k);
      const scaleTo = (f: number) => set({ ...s, scale: f });
      return (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {(["W", "D", "H"] as const).map((l, a) => (
              <LenField
                key={l}
                label={t(l)}
                mm={dims[a]}
                min={0.01}
                title={t("Resizes proportionally")}
                onChange={(v) => dims[a] > 0 && scaleTo((k * v) / dims[a])}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="w-[120px]">
              <NumField label={t("Factor")} value={k} step={0.1} digits={4} min={0.0001} onChange={scaleTo} />
            </div>
            <button className="btn !h-7 !px-2 text-[11px]" title={t("File was in cm")} onClick={() => scaleTo(10)}>
              cm→mm
            </button>
            <button className="btn !h-7 !px-2 text-[11px]" title={t("File was in inches")} onClick={() => scaleTo(25.4)}>
              in→mm
            </button>
            <button className="btn ghost !h-7 !px-2 text-[11px]" onClick={() => scaleTo(1)}>
              1:1
            </button>
          </div>
          <div className="text-[11px] text-ink-500 mt-2 leading-snug">
            {asset?.format === "step"
              ? t('From "{name}" (STEP): exact CAD geometry.', { name: asset.name })
              : s.mode === "mesh"
                ? t(
                    'From "{name}" as a mesh ({tris} triangles): move, rotate, lay flat and export. Convert to a CAD body for edges, faces, holes and union.',
                    { name: asset?.name ?? t("File"), tris: tris.toLocaleString(locale()) },
                  )
                : t('From "{name}" ({format}): flat faces were merged into CAD faces, curves stay faceted.', {
                    name: asset?.name ?? t("File"),
                    format: asset?.format.toUpperCase() ?? "",
                  })}
          </div>
          {s.mode === "mesh" && (
            <button className="btn w-full mt-2" onClick={() => convertMeshAsset(s.asset)}>
              {t("Convert to CAD body")}
              {tris > 40_000 && <span className="text-amber-300 text-[11px]">· {t("may take minutes")}</span>}
            </button>
          )}
        </>
      );
    }
    case "group":
      return <GroupDims body={body} onShape={onShape} />;
  }
}

type GroupBody = Body & { shape: Extract<Shape, { kind: "group" }> };

/** outer size of a combined body; changing it scales all parts (round parts stay round) */
function GroupDims({ body, onShape }: { body: Body; onShape?: (shape: Shape) => void }) {
  useMeshes((s) => s.meshes);
  const [pct, setPct] = useState(100);
  if (body.shape.kind !== "group") return null;
  const box = localBox(body.shape);
  const dims = [0, 1, 2].map((a) => box.max.getComponent(a) - box.min.getComponent(a));
  const apply = (f: Vec3, centred = false) => {
    if (onShape) {
      // nested part: no own features to carry along
      const b = localBox(body.shape);
      const anchor = b.min.toArray() as Vec3;
      onShape(scaleGroupShape(body.shape as GroupBody["shape"], anchor, f).shape);
      return;
    }
    const patch = scaleGroup(body, f, centred);
    if (patch) updateBody(body.id, patch);
  };
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {(["W", "D", "H"] as const).map((l, a) => (
          <LenField
            key={l}
            label={t(l)}
            mm={dims[a]}
            min={0.05}
            title={t("{dim}: scales all parts in this direction", { dim: t(["Width", "Depth", "Height"][a]) })}
            onChange={(v) => {
              const f: Vec3 = [1, 1, 1];
              f[a] = v / Math.max(dims[a], 1e-6);
              apply(f);
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="w-[130px]">
          <NumField label={t("Scale")} value={pct} suffix="%" step={5} min={1} onChange={setPct} />
        </div>
        <button
          className="btn !h-7 !px-2 text-[12px]"
          disabled={Math.abs(pct - 100) < 1e-9}
          title={t("Scale everything proportionally (stays centered on the bed)")}
          onClick={() => {
            const k = pct / 100;
            apply([k, k, k], true);
            setPct(100);
          }}
        >
          {t("Apply")}
        </button>
      </div>
      <div className="text-[11px] text-ink-500 mt-1.5 leading-snug">{t("Dragging the handles scales too · with Shift proportionally.")}</div>
    </>
  );
}

const ROLE: Record<string, { label: string; cls: string }> = {
  base: { label: "Base", cls: "bg-accent/25 text-sky-200" },
  tool: { label: "subtracted", cls: "bg-rose-500/20 text-rose-300" },
  solid: { label: "Solid", cls: "bg-ink-700 text-ink-300" },
  hole: { label: "Hole", cls: "bg-ink-700 text-ink-300" },
};

/** the parts inside a combined body: operation, roles, and each part's own dimensions/position */
function GroupParts({ body }: { body: GroupBody }) {
  const op = body.shape.op ?? "union";
  const focus = useStore((s) => s.groupFocus);
  const open = focus?.groupId === body.id ? focus.childId : null;
  const setOpen = (childId: string | null) => useStore.setState({ groupFocus: childId ? { groupId: body.id, childId } : null });
  const rotated = body.quaternion.some((v, i) => Math.abs(v - (i === 3 ? 1 : 0)) > 1e-9);
  return (
    <Section title={t("Parts & Operation")}>
      <div className="seg w-full mb-2 !flex">
        {OPS.map((o) => (
          <button
            key={o.op}
            className={`flex-1 ${op === o.op ? "on" : ""}`}
            style={op === o.op ? { background: `${TOOL_COLOR[o.op]}33`, color: TOOL_COLOR[o.op], boxShadow: `inset 0 0 0 1px ${TOOL_COLOR[o.op]}99` } : undefined}
            title={t(o.tip)}
            onClick={() => setGroupOp(body.id, o.op as BoolOp)}
          >
            {t(o.short)}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {body.shape.children.map((c, i) => {
          const role = op === "subtract" ? (i === 0 ? "base" : "tool") : c.hole ? "hole" : "solid";
          const isOpen = open === c.id;
          const cm = bodyMatrix(c);
          const cb = localBox(c.shape).applyMatrix4(cm);
          const off = rotated ? [0, 0, 0] : body.position;
          return (
            <div key={c.id} className={`rounded-md border ${isOpen ? "border-amber-400/60 bg-ink-850" : "border-ink-750"}`}>
              <div className="flex items-center gap-1.5 h-8 px-2 cursor-pointer" onClick={() => setOpen(isOpen ? null : c.id)}>
                {isOpen ? <ChevronUp size={13} className="text-ink-400" /> : <ChevronDown size={13} className="text-ink-400" />}
                <span style={{ color: c.hole ? "#94a3b8" : c.color }}>{ICON[c.shape.kind]}</span>
                <span className="truncate flex-1 text-[12px]">{c.name}</span>
                <span className={`text-[10px] px-1.5 rounded ${ROLE[role].cls}`}>{t(ROLE[role].label)}</span>
              </div>
              {isOpen && (
                <div className="px-2 pb-2 pt-0.5 flex flex-col gap-1.5">
                  <ShapeParams body={c} onShape={(shape) => updateGroupChild(body.id, c.id, { shape })} />
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["X", "Y", "Z"] as const).map((l, a) => (
                      <LenField
                        key={l}
                        label={l}
                        mm={cb.min.getComponent(a) + off[a]}
                        title={rotated ? t("Position inside the rotated body") : t("Position (bottom / left / front edge)")}
                        onChange={(v) => {
                          const p: Vec3 = [...c.position];
                          p[a] += v - (cb.min.getComponent(a) + off[a]);
                          updateGroupChild(body.id, c.id, { position: p });
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {op === "subtract" && i > 0 && (
                      <button className="btn flex-1 !h-7 text-[12px]" title={t("This part becomes the base, everything else is subtracted from it")} onClick={() => setGroupBase(body.id, c.id)}>
                        {t("Set as base")}
                      </button>
                    )}
                    {op !== "subtract" && op !== "intersect" && (
                      <button className="btn flex-1 !h-7 text-[12px]" onClick={() => updateGroupChild(body.id, c.id, { hole: !c.hole })}>
                        {c.hole ? t("Set as solid") : t("Set as hole")}
                      </button>
                    )}
                    <button className="btn flex-1 !h-7 text-[12px]" title={t("Take out of the body, stays in place")} onClick={() => extractGroupChild(body.id, c.id)}>
                      <LogOut size={13} /> {t("Extract")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-ink-500 mt-2 leading-snug">
        {op === "subtract"
          ? t("Subtracted parts are invisible but still there: expand a part to edit it, it is shown in orange in the model.")
          : op === "intersect"
            ? t("Only what all parts have in common remains.")
            : op === "group"
              ? t("Parts stay separate solids and move together.")
              : t("Parts are merged into one body; holes are subtracted.")}
      </div>
    </Section>
  );
}

function MultiProps({ bodies }: { bodies: Body[] }) {
  useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const ordered = selection.map((id) => bodies.find((b) => b.id === id)).filter((b): b is Body => !!b);
  const box = unionBox(bodies);
  const unit = useStore((s) => s.doc.settings.unit);
  const AlignRow = ({ axis, label, icons }: { axis: 0 | 1 | 2; label: string; icons: ReactNode[] }) => (
    <div className="flex items-center gap-1.5">
      <span className="w-4 text-ink-400 text-[11px]">{label}</span>
      {(["min", "center", "max"] as const).map((m, i) => (
        <button key={m} className="btn flex-1" title={t(m === "min" ? "{axis}: align start" : m === "center" ? "{axis}: align center" : "{axis}: align end", { axis: label })} onClick={() => alignSelection(axis, m)}>
          {icons[i]}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="text-[15px] font-semibold">{t("{count} bodies selected", { count: bodies.length })}</div>
        <div className="text-[11px] text-ink-500 mt-0.5">
          {fmtLen(box.max.x - box.min.x, unit)} × {fmtLen(box.max.y - box.min.y, unit)} × {fmtLen(box.max.z - box.min.z, unit)}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {OPS.map((o) => (
            <button
              key={o.op}
              className="btn op-btn !h-9"
              style={{ "--tc": TOOL_COLOR[o.op] } as React.CSSProperties}
              title={t(o.tip) + (o.kbd ? ` (${t(o.kbd)})` : "")}
              onClick={() => combineSelection(o.op)}
            >
              {o.icon(16)} {t(o.label)}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-ink-500 mt-2 leading-snug">
          {tn(
            ordered.length > 2
              ? "Order matters when subtracting: {base} is the base, {rest} are subtracted."
              : ordered.length > 1
                ? "Order matters when subtracting: {base} is the base, {rest} is subtracted."
                : "Order matters when subtracting: {base} is the base.",
            {
              base: <b className="text-ink-300">{ordered[0]?.name}</b>,
              rest: ordered
                .slice(1)
                .map((b) => b.name)
                .join(", "),
            },
          )}{" "}
          {t("Nothing gets lost: all parts stay in the result and remain editable.")}
        </div>
      </div>
      <Section title={t("Align")}>
        <div className="flex flex-col gap-1.5">
          <AlignRow axis={0} label="X" icons={[<AlignStartVertical size={14} />, <AlignCenterVertical size={14} />, <AlignEndVertical size={14} />]} />
          <AlignRow axis={1} label="Y" icons={[<AlignEndHorizontal size={14} />, <AlignCenterHorizontal size={14} />, <AlignStartHorizontal size={14} />]} />
          <AlignRow axis={2} label="Z" icons={[<AlignEndHorizontal size={14} />, <AlignCenterHorizontal size={14} />, <AlignStartHorizontal size={14} />]} />
        </div>
      </Section>
      <Section title={t("Position (together)")}>
        <div className="grid grid-cols-3 gap-1.5">
          <LenField label="X" mm={box.min.x} onChange={(v) => setSelectionMin(0, v)} />
          <LenField label="Y" mm={box.min.y} onChange={(v) => setSelectionMin(1, v)} />
          <LenField label="Z" mm={box.min.z} onChange={(v) => setSelectionMin(2, v)} />
        </div>
        <button className="btn w-full mt-2" onClick={dropToBed}>
          <ArrowDownToLine size={14} /> {t("Drop all to bed")}
        </button>
        <CenterButtons label={t("Center together")} />
      </Section>
      <Section title={t("Rotate (together)")}>
        <RotateButtons />
      </Section>
      <Section title={t("Actions")}>
        <div className="grid grid-cols-2 gap-1.5">
          <button className="btn" onClick={duplicateSelection}>
            <Copy size={14} /> {t("Duplicate")}
          </button>
          <button className="btn danger" onClick={deleteSelection}>
            <Trash2 size={14} /> {t("Delete")}
          </button>
        </div>
      </Section>
    </>
  );
}

function SketchProps({ sketch }: { sketch: Sketch }) {
  const height = useStore((st) => st.extrudeHeight);
  const setHeight = (v: number) => useStore.setState({ extrudeHeight: v });
  const s = sketch.shape;
  const upd = (shape: SketchShape) => updateSketch(sketch.id, shape);
  const unit = useStore((st) => st.doc.settings.unit);
  const view = useStore((st) => st.view);
  const flat = sketch.plane.orient === "top";
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="flex items-center gap-2 text-sky-400 text-[11px] mb-1">
          {SKETCH_ICON[s.kind]} {t("Sketch")} · {t(s.kind === "rect" ? "Rectangle" : s.kind === "circle" ? "Circle" : "Polygon")} ·{" "}
          {t(ORIENT_LABEL[sketch.plane.orient])}
        </div>
        <div className="text-[15px] font-semibold">{sketch.name}</div>
      </div>
      <Section title={t("Dimensions")}>
        {s.kind === "rect" && (
          <>
            <Grid2>
              <LenField label={t("Width")} mm={s.w} min={0.05} onChange={(w) => upd({ ...s, w })} />
              <LenField label={flat || sketch.plane.orient === "bottom" ? t("Depth") : t("Height")} mm={s.d} min={0.05} onChange={(d) => upd({ ...s, d })} />
              <LenField label={flat ? "X" : t("Left")} mm={s.x} onChange={(x) => upd({ ...s, x })} title={t("Left edge (in the sketch plane)")} />
              <LenField label={flat ? "Y" : t("Bottom")} mm={s.y} onChange={(y) => upd({ ...s, y })} title={flat ? t("Front edge") : t("Bottom edge (in the sketch plane)")} />
            </Grid2>
            <div className="text-[11px] text-ink-500 mt-1.5">
              {t("Center: {x} / {y}", { x: fmtLen(s.x + s.w / 2, unit), y: fmtLen(s.y + s.d / 2, unit) })}
            </div>
          </>
        )}
        {s.kind === "circle" && (
          <Grid2>
            <LenField label="Ø" mm={s.d} min={0.05} onChange={(d) => upd({ ...s, d })} />
            <div />
            <LenField label={t("Center {axis}", { axis: flat ? "X" : "↔" })} mm={s.cx} onChange={(cx) => upd({ ...s, cx })} />
            <LenField label={t("Center {axis}", { axis: flat ? "Y" : "↕" })} mm={s.cy} onChange={(cy) => upd({ ...s, cy })} />
          </Grid2>
        )}
        {s.kind === "poly" && (
          <div className="text-ink-300 text-[12px]">
            {t("{count} points · Area {area}", {
              count: s.points.length,
              area: fmtLen(Math.abs(polygonArea(s.points)), unit).replace(/ (\w+)$/, " $1²"),
            })}
          </div>
        )}
        <div className="mt-1.5">
          <LenField
            label={t("Plane {axis}", { axis: PLANE_AXIS_NAME[PLANE_AXIS[sketch.plane.orient]] })}
            mm={sketch.plane.value}
            onChange={(value) => updateSketch(sketch.id, s, { ...sketch.plane, value })}
            title={t("Position of the sketch plane (can also be dragged in the plane preview at the top right)")}
          />
        </div>
      </Section>
      <Section title={t("Extrude → 3D")}>
        <LenField label={t("Height")} mm={height} onChange={setHeight} />
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <button className="btn primary" onClick={() => extrudeSketch(sketch.id, height)}>
            {t("Extrude")}
          </button>
          <button className="btn" onClick={() => extrudeSketch(sketch.id, height, true)}>
            {t("As hole")}
          </button>
        </div>
        <div className="text-[11px] text-ink-500 mt-2">
          {viewAxis(view) === PLANE_AXIS[sketch.plane.orient]
            ? t("Tip: in the 3D view you can also drag the arrow.")
            : t("Or drag the arrow in the view.")}{" "}
          {t("A negative height extrudes in the opposite direction.")}
        </div>
      </Section>
      <Section title={t("Actions")}>
        <button className="btn danger w-full" onClick={deleteSelection}>
          <Trash2 size={14} /> {t("Delete sketch")}
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
  const showBed = useStore((s) => s.showBed);
  const count = useStore((s) => s.doc.bodies.length);
  return (
    <>
      <div className="px-3.5 pt-3 pb-3">
        <div className="text-[15px] font-semibold">{t("Project")}</div>
        <div className="text-[12px] text-ink-500">
          {count === 1 ? t("1 body · nothing selected") : t("{count} bodies · nothing selected", { count })}
        </div>
      </div>
      <Section title={t("Grid & Units")}>
        <div className="flex flex-wrap gap-1.5">
          {SNAP_OPTIONS[settings.unit].map((o) => (
            <button key={o.label} className={`btn !h-7 ${Math.abs(o.mm - settings.snap) < 1e-9 ? "primary" : ""}`} onClick={() => setSettings({ snap: o.mm })}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-ink-500 mt-2">
          {tn("Everything snaps to this grid. Hold {key} while dragging for free values.", { key: <kbd>Alt</kbd> })}
        </div>
      </Section>
      <Section
        title={t("Print bed")}
        right={<Switch on={showBed} onChange={setShowBed} label={t("show")} title={t("Show or hide the print bed in the model")} />}
      >
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
        {count > 0 && <CenterButtons label={t("Center all")} />}
      </Section>
      <Section title={t("How it works")}>
        <ol className="text-[12px] text-ink-300 list-decimal pl-4 space-y-1.5">
          <li>
            {tn("Draw a sketch ({r}/{c}/{p}), adjust dimensions right in the panel or on the label.", {
              r: <kbd>R</kbd>,
              c: <kbd>C</kbd>,
              p: <kbd>P</kbd>,
            })}
          </li>
          <li>{t("Extrude: enter a height or drag the arrow.")}</li>
          <li>{t("Drag parts against each other, they snap to faces (pink lines).")}</li>
          <li>{tn("Select several and unite them ({ctrl}+{g}).", { ctrl: <kbd>{t("Ctrl")}</kbd>, g: <kbd>G</kbd> })}</li>
          <li>{tn("Fillet edges ({key}): click an edge, drag the arrow.", { key: <kbd>F</kbd> })}</li>
          <li>{t("Export as 3MF or STL.")}</li>
        </ol>
      </Section>
    </>
  );
}
