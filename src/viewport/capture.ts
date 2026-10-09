import * as THREE from "three";
import type { RootState } from "@react-three/fiber";
import { VIEW_DIR } from "../lib/planes";
import { sceneBox } from "./CameraRig";

let getState: (() => RootState) | null = null;

export function registerCanvas(get: () => RootState) {
  getState = get;
}

/**
 * Small 3D picture of the scene (for the project list): rendered from the usual 3D angle into a corner
 * of the main canvas and copied out right away, then the corner is repainted.
 */
export function captureThumbnail(w = 240, h = 150): string | null {
  const st = getState?.();
  if (!st) return null;
  const { gl, scene, size } = st;
  if (size.width < w || size.height < h) return null;
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.5, 100000);
  cam.up.set(0, 0, 1);
  const box = sceneBox();
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 10);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 0.9;
  cam.position.copy(center).addScaledVector(VIEW_DIR.iso, dist);
  cam.near = dist / 500;
  cam.far = dist * 50;
  cam.lookAt(center);
  cam.updateProjectionMatrix();

  const hidden: THREE.Object3D[] = [];
  for (const c of scene.children) {
    if (c.userData.noInset && c.visible) {
      c.visible = false;
      hidden.push(c);
    }
  }
  const clear = new THREE.Color();
  gl.getClearColor(clear);
  const alpha = gl.getClearAlpha();
  const autoClear = gl.autoClear;
  let url: string | null = null;
  try {
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setScissor(0, 0, w, h);
    gl.setViewport(0, 0, w, h);
    gl.setClearColor("#1b1d23", 1);
    gl.clear(true, true, false);
    gl.render(scene, cam);
    // the drawing buffer is still intact within this task
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const pr = gl.getPixelRatio();
    const src = gl.domElement;
    out.getContext("2d")?.drawImage(src, 0, src.height - h * pr, w * pr, h * pr, 0, 0, w, h);
    url = out.toDataURL("image/jpeg", 0.82);
  } catch {
    url = null;
  } finally {
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor(clear, alpha);
    gl.autoClear = autoClear;
    for (const c of hidden) c.visible = true;
  }
  // paint the regular frame over the corner before the browser shows it
  try {
    st.advance(performance.now());
  } catch {
    st.invalidate();
  }
  return url;
}
