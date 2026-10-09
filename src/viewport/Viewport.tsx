import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { select, useStore } from "../store/store";
import { CameraRig } from "./CameraRig";
import { Ground } from "./Ground";
import { BodyView } from "./BodyView";
import { SketchTool, SketchView } from "./Sketching";
import { SelectionGizmos, SketchGizmos } from "./Gizmos";
import { EditTool } from "./EditTool";
import { InsetRenderer, InsetScene } from "./PlaneInset";
import { ViewHoverIndicator } from "./ViewHover";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

function Bodies() {
  const bodies = useStore((s) => s.doc.bodies);
  // solids first, holes last so transparency sorts nicely
  const ordered = [...bodies.filter((b) => !b.hole), ...bodies.filter((b) => b.hole)];
  return (
    <>
      {ordered.map((b) => (b.hidden ? null : <BodyView key={b.id} body={b} />))}
    </>
  );
}

function Sketches() {
  const sketches = useStore((s) => s.doc.sketches);
  return (
    <>
      {sketches.map((s) => (
        <SketchView key={s.id} sketch={s} />
      ))}
    </>
  );
}

function Guides() {
  const guides = useStore((s) => s.guides);
  return (
    <>
      {guides.map((g, i) => (
        <Line key={i} points={[g.a, g.b]} color="#f472b6" lineWidth={1.8} dashed dashSize={2} gapSize={1.5} depthTest={false} renderOrder={18} />
      ))}
    </>
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#e8eefc", "#3a3f4a", 1.35]} />
      <directionalLight position={[180, -260, 420]} intensity={1.6} />
      <directionalLight position={[-300, 200, 160]} intensity={0.55} />
      <directionalLight position={[0, 0, -300]} intensity={0.25} />
    </>
  );
}

export function Viewport() {
  return (
    <Canvas
      className="viewport-canvas"
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      onPointerMissed={(e) => {
        const s = useStore.getState();
        if (e.button !== 0) return;
        if (s.tool === "select") select([]);
      }}
      onCreated={(state) => {
        state.gl.setClearColor("#1b1d23");
        if (import.meta.env.DEV) Object.assign(window, { __r3f: state.get });
      }}
    >
      <CameraRig />
      <Lights />
      <group userData={{ noInset: true }}>
        <Ground />
      </group>
      <Bodies />
      <Sketches />
      <SketchTool />
      <InsetScene />
      <group userData={{ noInset: true }}>
        <SelectionGizmos />
        <SketchGizmos />
        <EditTool />
        <Guides />
        <ViewHoverIndicator />
      </group>
      <InsetRenderer />
    </Canvas>
  );
}
