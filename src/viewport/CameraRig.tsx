import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Sketch } from "../types";
import { useStore } from "../store/store";
import { polyBounds, unionBox } from "../lib/geom";
import { fromPlane2D, VIEW_DIR } from "../lib/planes";

const FOV = 35;

export function sketchBox(s: Sketch, box = new THREE.Box3()) {
  const sh = s.shape;
  let x0: number, y0: number, x1: number, y1: number;
  if (sh.kind === "rect") [x0, y0, x1, y1] = [sh.x, sh.y, sh.x + sh.w, sh.y + sh.d];
  else if (sh.kind === "circle") [x0, y0, x1, y1] = [sh.cx - sh.d / 2, sh.cy - sh.d / 2, sh.cx + sh.d / 2, sh.cy + sh.d / 2];
  else {
    const pb = polyBounds(sh.points);
    [x0, y0, x1, y1] = [pb.minX, pb.minY, pb.maxX, pb.maxY];
  }
  box.expandByPoint(fromPlane2D(s.plane, x0, y0));
  box.expandByPoint(fromPlane2D(s.plane, x1, y1));
  return box;
}

export function sceneBox() {
  const { doc } = useStore.getState();
  const box = unionBox(doc.bodies.filter((b) => !b.hidden));
  for (const s of doc.sketches) sketchBox(s, box);
  if (box.isEmpty()) {
    const { x, y } = doc.settings.bed;
    box.set(new THREE.Vector3(-x * 0.35, -y * 0.35, 0), new THREE.Vector3(x * 0.35, y * 0.35, 10));
  }
  const size = box.getSize(new THREE.Vector3());
  // keep tiny parts from filling the whole screen
  const min = 40;
  box.expandByVector(new THREE.Vector3(Math.max(0, (min - size.x) / 2), Math.max(0, (min - size.y) / 2), Math.max(0, (min - size.z) / 4)));
  return box;
}

/** pending hand-over from a 2D view to the 3D view while the right mouse button is held */
let transfer: { position: THREE.Vector3; target: THREE.Vector3; init: PointerEventInit } | null = null;

export function CameraRig() {
  const view = useStore((s) => s.view);
  const fitNonce = useStore((s) => s.fitNonce);
  const isOrtho = view !== "iso";
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const camRef = useRef(camera);
  camRef.current = camera;
  const ctlRef = useRef(controls);
  ctlRef.current = controls;

  // holding the right button in a 2D view means "I want to orbit": continue in 3D from the same spot
  useEffect(() => {
    const container = gl.domElement.parentElement ?? gl.domElement;
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 2 || !container.contains(ev.target as Node)) return;
      const s = useStore.getState();
      const cam = camRef.current as THREE.OrthographicCamera;
      const ctl = ctlRef.current;
      if (s.view === "iso" || !cam.isOrthographicCamera || !ctl) return;
      ev.stopImmediatePropagation();
      const target = ctl.target.clone();
      const dir = cam.position.clone().sub(target).normalize();
      // straight from above the orbit has no defined "up": tilt a hair towards the front (keeps +Y up on screen)
      if (Math.abs(dir.z) > 0.999) dir.set(0, -0.03, Math.sign(dir.z)).normalize();
      const visible = (cam.top - cam.bottom) / cam.zoom;
      const dist = visible / 2 / Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
      transfer = {
        position: target.clone().addScaledVector(dir, dist),
        target,
        init: { pointerId: ev.pointerId, pointerType: ev.pointerType, button: 2, buttons: 2, clientX: ev.clientX, clientY: ev.clientY, isPrimary: true, bubbles: true },
      };
      useStore.setState({ view: "iso", viewFlash: s.viewFlash + 1 });
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [gl]);

  useEffect(() => {
    if (!controls || (controls as unknown as { object: THREE.Camera }).object !== camera) return;
    if (transfer && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const t = transfer;
      transfer = null;
      camera.up.set(0, 0, 1);
      camera.position.copy(t.position);
      controls.target.copy(t.target);
      camera.lookAt(t.target);
      controls.update();
      invalidate();
      // let the fresh orbit controls pick up the button that is still held
      const el = (controls as unknown as { domElement: HTMLElement }).domElement ?? gl.domElement;
      requestAnimationFrame(() => el.dispatchEvent(new PointerEvent("pointerdown", t.init)));
      return;
    }
    const box = sceneBox();
    const center = box.getCenter(new THREE.Vector3());
    const dims = box.getSize(new THREE.Vector3());
    const dir = VIEW_DIR[view];
    if (view === "top") camera.up.set(0, 1, 0);
    else if (view === "bottom") camera.up.set(0, -1, 0);
    else camera.up.set(0, 0, 1);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const cam = camera as THREE.OrthographicCamera;
      cam.position.copy(center).addScaledVector(dir, 2000);
      const { width, height } = sizeRef.current;
      const sw = view === "right" || view === "left" ? dims.y : dims.x;
      const sh = view === "top" || view === "bottom" ? dims.y : dims.z;
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
    // the ground grid derives its fade from the camera of the previous frame: draw once more
    const raf = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(raf);
  }, [view, fitNonce, controls, camera, invalidate, gl]);

  // left button is reserved for selecting/drawing; hold the right button to orbit (2D views switch to 3D first)
  return (
    <>
      <PerspectiveCamera makeDefault={!isOrtho} fov={FOV} near={0.5} far={50000} position={[200, -320, 260]} up={[0, 0, 1]} />
      <OrthographicCamera makeDefault={isOrtho} near={-50000} far={50000} position={[0, 0, 2000]} zoom={3} />
      <OrbitControls
        makeDefault
        enableRotate={!isOrtho}
        enableDamping={false}
        zoomToCursor
        screenSpacePanning
        mouseButtons={{ LEFT: -1 as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: isOrtho ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE }}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </>
  );
}
