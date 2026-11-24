import type { RootState } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Vec3 } from "../types";
import type { View } from "../store/store";
import { useStore } from "../store/store";

/** where the camera is: which view, from where it looks at what, how far zoomed */
export interface CameraPose {
  view: View;
  position: Vec3;
  target: Vec3;
  up: Vec3;
  zoom: number;
}

let getState: (() => RootState) | null = null;
let pending: CameraPose | null = null;

export function registerPoseCanvas(get: () => RootState) {
  getState = get;
}

/** the camera as it is right now (to remember it with the project) */
export function readCameraPose(): CameraPose | undefined {
  const st = getState?.();
  const ctl = st?.controls as unknown as OrbitControlsImpl | null;
  if (!st || !ctl) return undefined;
  const r = (v: { x: number; y: number; z: number }): Vec3 => [v.x, v.y, v.z].map((n) => Math.round(n * 1e4) / 1e4) as Vec3;
  return { view: useStore.getState().view, position: r(st.camera.position), target: r(ctl.target), up: r(st.camera.up), zoom: st.camera.zoom };
}

/** the next time the camera is set up, it goes to this pose instead of fitting the scene */
export function requestCameraPose(pose: CameraPose | undefined) {
  pending = pose ?? null;
}

/** the waiting pose, once the right kind of camera (3D or 2D) is active */
export function takeCameraPose(perspective: boolean): CameraPose | null {
  if (!pending || (pending.view === "iso") !== perspective) return null;
  const p = pending;
  pending = null;
  return p;
}
