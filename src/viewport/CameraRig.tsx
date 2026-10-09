import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useStore, type View } from "../store/store";
import { unionBox } from "../lib/geom";
import { polyBounds } from "../lib/geom";

const VIEW_DIR: Record<View, THREE.Vector3> = {
  iso: new THREE.Vector3(0.75, -1.25, 0.95).normalize(),
  top: new THREE.Vector3(0, 0, 1),
  front: new THREE.Vector3(0, -1, 0),
  right: new THREE.Vector3(1, 0, 0),
};

function sceneBox() {
  const { doc } = useStore.getState();
  const box = unionBox(doc.bodies.filter((b) => !b.hidden));
  for (const s of doc.sketches) {
    const sh = s.shape;
    if (sh.kind === "rect") {
      box.expandByPoint(new THREE.Vector3(sh.x, sh.y, s.z));
      box.expandByPoint(new THREE.Vector3(sh.x + sh.w, sh.y + sh.d, s.z));
    } else if (sh.kind === "circle") {
      box.expandByPoint(new THREE.Vector3(sh.cx - sh.d / 2, sh.cy - sh.d / 2, s.z));
      box.expandByPoint(new THREE.Vector3(sh.cx + sh.d / 2, sh.cy + sh.d / 2, s.z));
    } else {
      const pb = polyBounds(sh.points);
      box.expandByPoint(new THREE.Vector3(pb.minX, pb.minY, s.z));
      box.expandByPoint(new THREE.Vector3(pb.maxX, pb.maxY, s.z));
    }
  }
  if (box.isEmpty()) {
    const { x, y } = doc.settings.bed;
    box.set(new THREE.Vector3(-x * 0.35, -y * 0.35, 0), new THREE.Vector3(x * 0.35, y * 0.35, 10));
  }
  const size = box.getSize(new THREE.Vector3());
  // keep tiny parts from filling the whole screen
  const min = 40;
  if (size.x < min || size.y < min) box.expandByVector(new THREE.Vector3(Math.max(0, (min - size.x) / 2), Math.max(0, (min - size.y) / 2), 0));
  return box;
}

export function CameraRig() {
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.tool);
  const fitNonce = useStore((s) => s.fitNonce);
  const isOrtho = view !== "iso";
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    if (!controls) return;
    const box = sceneBox();
    const center = box.getCenter(new THREE.Vector3());
    const dims = box.getSize(new THREE.Vector3());
    const dir = VIEW_DIR[view];
    if (view === "top") camera.up.set(0, 1, 0);
    else camera.up.set(0, 0, 1);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const cam = camera as THREE.OrthographicCamera;
      cam.position.copy(center).addScaledVector(dir, 2000);
      const { width, height } = sizeRef.current;
      const sw = view === "right" ? dims.y : dims.x;
      const sh = view === "top" ? dims.y : dims.z;
      cam.zoom = Math.min(width / (Math.max(sw, 1) * 1.6), height / (Math.max(sh, 1) * 1.6));
      cam.updateProjectionMatrix();
    } else {
      const cam = camera as THREE.PerspectiveCamera;
      const radius = Math.max(dims.length() / 2, 10);
      const fov = THREE.MathUtils.degToRad(cam.fov);
      const aspect = sizeRef.current.width / Math.max(sizeRef.current.height, 1);
      const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect));
      const dist = (radius / Math.sin(fit / 2)) * 1.05;
      cam.position.copy(center).addScaledVector(dir, dist);
      cam.near = Math.max(dist / 500, 0.1);
      cam.far = dist * 100;
      cam.updateProjectionMatrix();
    }
    controls.target.copy(center);
    camera.lookAt(center);
    controls.update();
    invalidate();
  }, [view, fitNonce, controls, camera, invalidate]);

  const drawing = tool === "rect" || tool === "circle" || tool === "poly";
  const leftButton = drawing || tool === "fillet" || tool === "layflat" ? -1 : isOrtho ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  const rightButton = isOrtho ? THREE.MOUSE.PAN : drawing || tool === "fillet" || tool === "layflat" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;

  return (
    <>
      <PerspectiveCamera makeDefault={!isOrtho} fov={35} near={0.5} far={50000} position={[200, -320, 260]} up={[0, 0, 1]} />
      <OrthographicCamera makeDefault={isOrtho} near={-50000} far={50000} position={[0, 0, 2000]} zoom={3} />
      <OrbitControls
        makeDefault
        enableRotate={!isOrtho}
        enableDamping={false}
        zoomToCursor
        screenSpacePanning
        mouseButtons={{ LEFT: leftButton as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: rightButton }}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </>
  );
}
