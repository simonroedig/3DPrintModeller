import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { StretchFeature, Vec3 } from "../types";
import { beginTx, endTx, setStretchAt, updateFeature, useStore } from "../store/store";
import { useMeshes } from "../cad/client";
import { worldBox } from "../lib/geom";
import { stretchInWorld, worldAlong, zoneOf } from "../lib/stretch";
import { fmtLen, snapTo } from "../lib/units";
import { AXIS_COLOR, viewAxis } from "../lib/planes";
import { TOOL_COLOR } from "../ui/theme";
import { Handle } from "./Gizmos";
import { startAxisDrag } from "./interaction";
import { t } from "../i18n";

/**
 * The stretch being edited: two see-through planes mark the zone that gets stretched or squeezed,
 * a double arrow moves the zone, an arrow on its start plane changes its length, and the arrow at
 * the end that moves makes the body longer (out) or shorter (in).
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
  const zone = zoneOf(f);
  // the zone as it looks now: from its start to where its far end moved
  const zStart = worldAlong(body, f, f.at - zone / 2);
  const zEnd = worldAlong(body, f, f.at + zone / 2 + f.amount);
  const planeAt = (v: number): Vec3[] => {
    const corner = (u: number, k: number): Vec3 => {
      const p: Vec3 = [0, 0, 0];
      p[A] = v;
      p[others[0]] = u ? box.max.getComponent(others[0]) + m : box.min.getComponent(others[0]) - m;
      p[others[1]] = k ? box.max.getComponent(others[1]) + m : box.min.getComponent(others[1]) - m;
      return p;
    };
    return [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
  };
  const planes = [planeAt(zStart), planeAt(zEnd)];
  const geo = new THREE.BufferGeometry().setFromPoints(
    planes.flatMap((q) => [q[0], q[1], q[2], q[0], q[2], q[3]]).map((p) => new THREE.Vector3(...p)),
  );
  const dir = new THREE.Vector3().setComponent(A, w.sign);
  const midPos = c.clone().setComponent(A, (zStart + zEnd) / 2);
  const startPos = c.clone().setComponent(A, zStart);
  // the end that moves
  const endPos = c.clone().setComponent(A, w.sign > 0 ? box.max.getComponent(A) : box.min.getComponent(A));
  // looking straight along the axis the arrows cannot be dragged
  const facing = viewAxis(view) === A;

  const drag = (origin: THREE.Vector3, along: THREE.Vector3, apply: (d: number, free: boolean) => string) => (e: { nativeEvent: PointerEvent }) => {
    beginTx();
    const ok = startAxisDrag(
      get(),
      e.nativeEvent,
      origin,
      along,
      (d, ev) => useStore.setState({ dragInfo: apply(d, ev.altKey) }),
      () => {
        endTx();
        useStore.setState({ dragInfo: null });
      },
    );
    if (!ok) endTx();
  };
  const sn = (v: number, free: boolean) => (free ? v : snapTo(v, snap));
  const dragMiddle = drag(midPos, new THREE.Vector3().setComponent(A, 1), (d, free) => {
    const v = sn(w.at + d, free);
    setStretchAt(body.id, f.id, v);
    return `${t("Middle")} ${"XYZ"[A]} ${fmtLen(v, unit)}`;
  });
  const dragZone = drag(startPos, dir.clone().negate(), (d, free) => {
    // both ends of the zone move apart (or together) by the drag
    const v = Math.max(0, sn(zone + 2 * d, free));
    updateFeature(body.id, f.id, { zone: Math.round(v * 1e6) / 1e6 });
    return `${t("Zone")} ${fmtLen(v, unit)}`;
  });
  const dragAmount = drag(endPos, dir, (d, free) => {
    const v = sn(f.amount + d, free);
    updateFeature(body.id, f.id, { amount: Math.round(v * 1e6) / 1e6 });
    return `${v >= 0 ? t("Longer") : t("Shorter")} ${v >= 0 ? "+" : ""}${fmtLen(v, unit)}`;
  });

  return (
    <group>
      <mesh geometry={geo} renderOrder={9}>
        <meshBasicMaterial color={TOOL_COLOR.stretch} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {planes.map((q, i) => (
        <Line key={i} points={[...q, q[0]]} color={TOOL_COLOR.stretch} lineWidth={1.8} depthTest={false} transparent opacity={0.9} renderOrder={10} />
      ))}
      {!facing && (
        <>
          <Handle position={midPos} dir={new THREE.Vector3().setComponent(A, 1)} arrow both color={TOOL_COLOR.stretch} title={t("Move the zone")} onDown={dragMiddle} />
          <Handle position={startPos} dir={dir.clone().negate()} grip color={TOOL_COLOR.stretch} title={t("Drag out: longer zone · in: shorter zone")} onDown={dragZone} />
          <Handle position={endPos} dir={dir} grip color={AXIS_COLOR[A]} title={t("Drag out: longer · in: shorter")} onDown={dragAmount} />
        </>
      )}
    </group>
  );
}
