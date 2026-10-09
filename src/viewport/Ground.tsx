import { useMemo } from "react";
import * as THREE from "three";
import { Grid, Line } from "@react-three/drei";
import { useStore } from "../store/store";

export function Ground() {
  const view = useStore((s) => s.view);
  const bed = useStore((s) => s.doc.settings.bed);
  const snap = useStore((s) => s.doc.settings.snap);
  const unit = useStore((s) => s.doc.settings.unit);

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
    if (view === "front") return [0, 0, 0]; // XZ plane
    if (view === "right") return [0, 0, Math.PI / 2]; // YZ plane
    return [Math.PI / 2, 0, 0]; // XY plane
  }, [view]);

  const gridPosition: [number, number, number] = view === "front" ? [0, 4000, 0] : view === "right" ? [-4000, 0, 0] : [0, 0, -0.01];

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
      {view !== "front" && view !== "right" && (
        <>
          <mesh position={[0, 0, -0.05]} receiveShadow>
            <planeGeometry args={[bed.x, bed.y]} />
            <meshBasicMaterial color="#2b6cb0" transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <Line points={bedOutline} color="#4a7fc1" lineWidth={1.5} transparent opacity={0.7} />
        </>
      )}
      {/* origin axes */}
      <Line points={[[0, 0, 0.02], [20, 0, 0.02]]} color="#e5484d" lineWidth={2} />
      <Line points={[[0, 0, 0.02], [0, 20, 0.02]]} color="#30a46c" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, 20]]} color="#3e63dd" lineWidth={2} />
    </group>
  );
}
