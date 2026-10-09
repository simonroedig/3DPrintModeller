import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Vec3 } from "../types";
import { useStore } from "../store/store";
import { useMeshes } from "../cad/client";
import { AXIS_COLOR, VIEW_DIR, viewAxis } from "../lib/planes";
import { sceneBox } from "./CameraRig";

/**
 * While the mouse is over a view button: a glowing panel on the side of the scene that view looks from,
 * plus an arrow pointing in its viewing direction (in the colour of that axis).
 */
export function ViewHoverIndicator() {
  const hover = useStore((s) => s.viewHover);
  const view = useStore((s) => s.view);
  const bodies = useStore((s) => s.doc.bodies);
  const sketches = useStore((s) => s.doc.sketches);
  const meshes = useMeshes((s) => s.meshes);
  const box = useMemo(() => sceneBox(), [bodies, sketches, meshes]); // eslint-disable-line react-hooks/exhaustive-deps
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    m.opacity = 0.16 + 0.12 * Math.sin(state.clock.elapsedTime * 6);
    state.invalidate(); // keep pulsing while shown
  });

  const geom = useMemo(() => {
    if (!hover || hover === view) return null;
    const dir = VIEW_DIR[hover];
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const reach = size.length() / 2;
    const axis = viewAxis(hover);
    const color = axis === null ? "#e2e8f0" : AXIS_COLOR[axis];
    // where the eye sits (just outside the scene) and where it looks
    const eye = center.clone().addScaledVector(dir, reach * 1.25 + 10);
    const tip = center.clone().addScaledVector(dir, reach * 0.55 + 4);
    let panel: { position: Vec3; quaternion: THREE.Quaternion; w: number; h: number } | null = null;
    if (axis !== null) {
      const sign = dir.getComponent(axis);
      const pos = center.clone();
      pos.setComponent(axis, (sign > 0 ? box.max : box.min).getComponent(axis) + sign * Math.max(size.getComponent(axis) * 0.08, 3));
      const [a1, a2] = [0, 1, 2].filter((a) => a !== axis);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      const pad = 1.15;
      // plane geometry is XY: figure out which world axes its local x/y end up on
      const lx = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
      const wa = Math.abs(lx.getComponent(a1)) > 0.5 ? a1 : a2;
      const ha = wa === a1 ? a2 : a1;
      panel = { position: pos.toArray() as Vec3, quaternion, w: size.getComponent(wa) * pad + 6, h: size.getComponent(ha) * pad + 6 };
    }
    const cone = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    return { color, eye: eye.toArray() as Vec3, tip: tip.toArray() as Vec3, cone, coneLen: Math.max(reach * 0.12, 5), panel };
  }, [hover, view, box]);

  if (!geom) return null;
  return (
    <group>
      {geom.panel && (
        <mesh position={geom.panel.position} quaternion={geom.panel.quaternion} renderOrder={30}>
          <planeGeometry args={[geom.panel.w, geom.panel.h]} />
          <meshBasicMaterial ref={matRef} color={geom.color} transparent opacity={0.22} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Line points={[geom.eye, geom.tip]} color={geom.color} lineWidth={3} depthTest={false} renderOrder={31} />
      <mesh position={geom.tip} quaternion={geom.cone} renderOrder={31}>
        <coneGeometry args={[geom.coneLen * 0.4, geom.coneLen, 16]} />
        <meshBasicMaterial color={geom.color} depthTest={false} transparent />
      </mesh>
    </group>
  );
}
