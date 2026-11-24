import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { StretchFeature, Vec3 } from "../types";
import { beginTx, endTx, setStretchAt, updateFeature, useStore } from "../store/store";
import { useMeshes } from "../cad/client";
import { worldBox } from "../lib/geom";
import { stretchInWorld } from "../lib/stretch";
import { fmtLen, snapTo } from "../lib/units";
import { AXIS_COLOR, viewAxis } from "../lib/planes";
import { TOOL_COLOR } from "../ui/theme";
import { Handle } from "./Gizmos";
import { startAxisDrag } from "./interaction";
import { t } from "../i18n";

/**
 * The stretch being edited: a see-through cut plane across the body, a double arrow on it to move
 * the cut, and an arrow at the end that moves to make the body longer (out) or shorter (in).
 */
export function StretchGizmo() {
  const edit = useStore((s) => s.stretchEdit);
  const body = useStore((s) => (s.stretchEdit ? s.doc.bodies.find((b) => b.id === s.stretchEdit!.bodyId) : undefined));
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.tool);
  useMeshes((s) => s.meshes);
  const get = useThree((s) => s.get);
  const f = body?.features.find((x) => x.id === edit?.featureId) as StretchFeature | undefined;
  if (!body || !f || f.type !== "stretch" || tool !== "select") return null;

  const w = stretchInWorld(body, f);
  const A = w.axis;
  const box = worldBox(body);
  if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3());
  const others = [0, 1, 2].filter((a) => a !== A);
  const m = 4;
  // the cut plane, a little bigger than the body
  const corner = (u: number, v: number): Vec3 => {
    const p: Vec3 = [0, 0, 0];
    p[A] = w.at;
    p[others[0]] = u ? box.max.getComponent(others[0]) + m : box.min.getComponent(others[0]) - m;
    p[others[1]] = v ? box.max.getComponent(others[1]) + m : box.min.getComponent(others[1]) - m;
    return p;
  };
  const quad = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
  const geo = new THREE.BufferGeometry().setFromPoints([quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]].map((p) => new THREE.Vector3(...p)));
  const dir = new THREE.Vector3().setComponent(A, w.sign);
  const cutPos = c.clone().setComponent(A, w.at);
  // the end that moves
  const endPos = c.clone().setComponent(A, w.sign > 0 ? box.max.getComponent(A) : box.min.getComponent(A));
  // looking straight along the axis the arrows cannot be dragged
  const facing = viewAxis(view) === A;

  const dragCut = (e: { nativeEvent: PointerEvent }) => {
    const at0 = w.at;
    beginTx();
    const ok = startAxisDrag(
      get(),
      e.nativeEvent,
      cutPos,
      new THREE.Vector3().setComponent(A, 1),
      (d, ev) => {
        const v = ev.altKey ? at0 + d : snapTo(at0 + d, snap);
        setStretchAt(body.id, f.id, v);
        useStore.setState({ dragInfo: `${t("Cut")} ${"XYZ"[A]} ${fmtLen(v, unit)}` });
      },
      () => {
        endTx();
        useStore.setState({ dragInfo: null });
      },
    );
    if (!ok) endTx();
  };
  const dragAmount = (e: { nativeEvent: PointerEvent }) => {
    const a0 = f.amount;
    beginTx();
    const ok = startAxisDrag(
      get(),
      e.nativeEvent,
      endPos,
      dir,
      (d, ev) => {
        const v = ev.altKey ? a0 + d : snapTo(a0 + d, snap);
        updateFeature(body.id, f.id, { amount: Math.round(v * 1e6) / 1e6 });
        useStore.setState({ dragInfo: `${v >= 0 ? t("Longer") : t("Shorter")} ${v >= 0 ? "+" : ""}${fmtLen(v, unit)}` });
      },
      () => {
        endTx();
        useStore.setState({ dragInfo: null });
      },
    );
    if (!ok) endTx();
  };

  return (
    <group>
      <mesh geometry={geo} renderOrder={9}>
        <meshBasicMaterial color={TOOL_COLOR.stretch} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={[...quad, quad[0]]} color={TOOL_COLOR.stretch} lineWidth={1.8} depthTest={false} transparent opacity={0.9} renderOrder={10} />
      {!facing && (
        <>
          <Handle position={cutPos} dir={new THREE.Vector3().setComponent(A, 1)} arrow both color={TOOL_COLOR.stretch} title={t("Move the cut")} onDown={dragCut} />
          <Handle position={endPos} dir={dir} grip color={AXIS_COLOR[A]} title={t("Drag out: longer · in: shorter")} onDown={dragAmount} />
        </>
      )}
    </group>
  );
}
