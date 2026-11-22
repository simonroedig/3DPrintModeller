import { useMemo } from "react";
import * as THREE from "three";
import { Billboard, Grid, Line } from "@react-three/drei";
import { useStore } from "../store/store";
import { unionBox } from "../lib/geom";
import { useMeshes } from "../cad/client";
import { ScreenScale } from "./Gizmos";

export function Ground() {
  const view = useStore((s) => s.view);
  const bed = useStore((s) => s.doc.settings.bed);
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);
  const showBed = useStore((s) => s.showBed);

  // grid cell follows the unit; section lines every 10 cells
  const cell = unit === "cm" ? 10 : unit === "in" ? 25.4 / 4 : Math.max(1, snap >= 5 ? snap : 1);
  const section = unit === "in" ? 25.4 : cell * 10;

  const bedOutline = useMemo(() => {
    const x = bed.x / 2;
    const y = bed.y / 2;
    return [
      [-x, -y, 0],
      [x, -y, 0],
      [x, y, 0],
      [-x, y, 0],
      [-x, -y, 0],
    ] as [number, number, number][];
  }, [bed]);

  const gridRotation = useMemo<[number, number, number]>(() => {
    if (view === "front" || view === "back") return [0, 0, 0]; // XZ plane
    if (view === "right" || view === "left") return [0, 0, Math.PI / 2]; // YZ plane
    return [Math.PI / 2, 0, 0]; // XY plane
  }, [view]);

  // in the side views the grid sits far behind everything
  const gridPosition: [number, number, number] =
    view === "front" ? [0, 4000, 0] : view === "back" ? [0, -4000, 0] : view === "right" ? [-4000, 0, 0] : view === "left" ? [4000, 0, 0] : view === "bottom" ? [0, 0, 4000] : [0, 0, -0.01];
  const side = view !== "iso" && view !== "top";

  return (
    <group>
      <Grid
        rotation={gridRotation}
        position={gridPosition}
        cellSize={cell}
        sectionSize={section}
        cellThickness={0.6}
        sectionThickness={1.1}
        cellColor="#3a3f4b"
        sectionColor="#4b5263"
        infiniteGrid
        fadeDistance={view === "iso" ? 2500 : 100000}
        fadeStrength={view === "iso" ? 2.5 : 0}
        followCamera={false}
        side={THREE.DoubleSide}
      />
      {!side && showBed && (
        <>
          <mesh position={[0, 0, -0.05]} receiveShadow>
            <planeGeometry args={[bed.x, bed.y]} />
            <meshBasicMaterial color="#2b6cb0" transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <Line points={bedOutline} color="#4a7fc1" lineWidth={1.5} transparent opacity={0.7} />
        </>
      )}
      <CenterLines />
      {/* origin axes */}
      <Line points={[[0, 0, 0.02], [20, 0, 0.02]]} color="#e5484d" lineWidth={2} />
      <Line points={[[0, 0, 0.02], [0, 20, 0.02]]} color="#30a46c" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, 20]]} color="#3e63dd" lineWidth={2} />
    </group>
  );
}

/**
 * The middle of the bed as long lines that stay visible on top of the bodies, plus a cross on the
 * middle of the selection: you can see at a glance whether a part really sits in the middle.
 */
function CenterLines() {
  const on = useStore((s) => s.centerLines);
  const bed = useStore((s) => s.doc.settings.bed);
  const bodies = useStore((s) => s.doc.bodies);
  const selection = useStore((s) => s.selection);
  useMeshes((s) => s.meshes);
  if (!on) return null;
  const visible = bodies.filter((b) => !b.hidden);
  const all = visible.length ? unionBox(visible) : null;
  const reach = (v: number) => Math.abs(v) + 20;
  const L = Math.max(bed.x / 2 + 15, bed.y / 2 + 15, all ? Math.max(reach(all.min.x), reach(all.max.x), reach(all.min.y), reach(all.max.y)) : 0);
  const H = Math.max(40, all ? all.max.z + 20 : 0);
  const sel = bodies.filter((b) => selection.includes(b.id) && !b.hidden);
  const box = sel.length ? unionBox(sel) : null;
  const c = box && !box.isEmpty() ? box.getCenter(new THREE.Vector3()) : null;
  // solid: the grid already has dashes right at the middle
  const line = { lineWidth: 1.6, transparent: true, depthTest: false, renderOrder: 30 } as const;
  return (
    <group>
      <Line points={[[-L, 0, 0], [L, 0, 0]]} color="#f87171" opacity={0.9} {...line} />
      <Line points={[[0, -L, 0], [0, L, 0]]} color="#4ade80" opacity={0.9} {...line} />
      <Line points={[[0, 0, 0], [0, 0, H]]} color="#60a5fa" opacity={0.8} {...line} />
      {c && box && (
        <ScreenScale position={[c.x, c.y, box.max.z]}>
          <Billboard>
            <Line points={[[-9, 0, 0], [9, 0, 0]]} color="#ffffff" lineWidth={2} depthTest={false} renderOrder={31} />
            <Line points={[[0, -9, 0], [0, 9, 0]]} color="#ffffff" lineWidth={2} depthTest={false} renderOrder={31} />
            <mesh renderOrder={31}>
              <ringGeometry args={[4, 5.5, 24]} />
              <meshBasicMaterial color="#ffffff" depthTest={false} transparent side={THREE.DoubleSide} />
            </mesh>
          </Billboard>
        </ScreenScale>
      )}
    </group>
  );
}
