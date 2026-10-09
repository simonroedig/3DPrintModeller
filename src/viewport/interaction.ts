import * as THREE from "three";
import type { RootState } from "@react-three/fiber";

/** meshes of rendered bodies, used for picking / occlusion tests */
export const bodyMeshes = new Map<string, THREE.Mesh>();

/** true while the pointer is over a gizmo handle — tools ignore clicks then */
export const pointerState = { overHandle: false, dragging: false };

export function ndcFromEvent(ev: { clientX: number; clientY: number }, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
}

const _rc = new THREE.Raycaster();

export function rayFromEvent(ev: { clientX: number; clientY: number }, state: RootState) {
  _rc.setFromCamera(ndcFromEvent(ev, state.gl.domElement), state.camera);
  return _rc.ray.clone();
}

export function raycasterFromEvent(ev: { clientX: number; clientY: number }, state: RootState) {
  const rc = new THREE.Raycaster();
  rc.setFromCamera(ndcFromEvent(ev, state.gl.domElement), state.camera);
  return rc;
}

/** Parameter t of the point on the line (origin + t·dir) closest to the ray; null if (nearly) parallel. */
export function closestOnAxis(ray: THREE.Ray, origin: THREE.Vector3, dir: THREE.Vector3): number | null {
  const d = dir.clone().normalize();
  const w0 = origin.clone().sub(ray.origin);
  const b = d.dot(ray.direction);
  const denom = 1 - b * b;
  if (denom < 1e-6) return null;
  const dd = d.dot(w0);
  const e = ray.direction.dot(w0);
  return (b * e - dd) / denom;
}

export function intersectPlane(ray: THREE.Ray, normal: THREE.Vector3, point: THREE.Vector3) {
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  return ray.intersectPlane(plane, new THREE.Vector3());
}

/** World units covered by one screen pixel at the given point. */
export function worldPerPixel(state: RootState, at: THREE.Vector3) {
  const cam = state.camera;
  const h = state.size.height || 1;
  if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
    const o = cam as THREE.OrthographicCamera;
    return (o.top - o.bottom) / o.zoom / h;
  }
  const p = cam as THREE.PerspectiveCamera;
  const dist = cam.position.distanceTo(at);
  return (2 * dist * Math.tan(THREE.MathUtils.degToRad(p.fov) / 2)) / h;
}

export function toScreen(p: THREE.Vector3, state: RootState) {
  const v = p.clone().project(state.camera);
  return new THREE.Vector2(((v.x + 1) / 2) * state.size.width, ((1 - v.y) / 2) * state.size.height);
}

type ControlsLike = { enabled: boolean } | null;

/**
 * Runs a pointer drag using window listeners (robust even when the pointer leaves the canvas).
 * Orbit controls are disabled for the duration.
 */
export function runDrag(
  state: RootState,
  handlers: { move: (ev: PointerEvent) => void; up?: (ev: PointerEvent, moved: boolean) => void },
  start: { clientX: number; clientY: number },
  threshold = 3,
) {
  const controls = state.controls as unknown as ControlsLike;
  if (controls) controls.enabled = false;
  pointerState.dragging = true;
  let moved = false;
  const onMove = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - start.clientX, ev.clientY - start.clientY) < threshold) return;
    moved = true;
    handlers.move(ev);
  };
  const onUp = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (controls) controls.enabled = true;
    pointerState.dragging = false;
    handlers.up?.(ev, moved);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

/** Drag along a world axis; reports the travelled distance along `dir`. */
export function startAxisDrag(
  state: RootState,
  ev: PointerEvent,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  onDelta: (t: number, ev: PointerEvent) => void,
  onEnd?: (moved: boolean) => void,
) {
  const d = dir.clone().normalize();
  const t0 = closestOnAxis(rayFromEvent(ev, state), origin, d);
  if (t0 === null) return false;
  runDrag(
    state,
    {
      move(e) {
        const t = closestOnAxis(rayFromEvent(e, state), origin, d);
        if (t === null) return;
        onDelta(t - t0, e);
      },
      up(_e, moved) {
        onEnd?.(moved);
      },
    },
    ev,
    1,
  );
  return true;
}
