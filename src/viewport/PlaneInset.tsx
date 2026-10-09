import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { SketchPlane, Vec3 } from "../types";
import { planeTarget, useStore } from "../store/store";
import { useMeshes } from "../cad/client";
import { AXIS_COLOR, fromPlane2D, planeBasis, PLANE_AXIS, VIEW_DIR } from "../lib/planes";
import { sceneBox } from "./CameraRig";

/** DOM element the plane preview is drawn into (see ui/PlanePanel) */
export const INSET_ID = "plane-inset-view";
const INSET_LAYER = 1;
const FOV = 30;

/** camera of the preview; kept still while the plane is dragged so it does not "swim" */
const inset = { position: new THREE.Vector3(200, -330, 260), target: new THREE.Vector3(), active: false };
let requestFrame: (() => void) | null = null;

/** millimetres per screen pixel when moving along a world axis in the preview (of the given pixel height) */
export function insetMmPerPx(axis: 0 | 1 | 2, heightPx: number) {
  const dist = inset.position.distanceTo(inset.target);
  const pxPerMm = heightPx / (2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV) / 2));
  const d = inset.target.clone().sub(inset.position).normalize();
  const a = new THREE.Vector3().setComponent(axis, 1);
  const onScreen = a.sub(d.multiplyScalar(a.dot(d))).length();
  return 1 / (pxPerMm * Math.max(onScreen, 0.3));
}

/** asks the (on-demand) canvas for a new frame, e.g. after the preview element moved */
export function invalidateInset() {
  requestFrame?.();
}

export function usePlaneTarget() {
  // re-evaluate whenever something the target depends on changes
  useStore((s) => s.tool);
  useStore((s) => s.selection);
  useStore((s) => s.doc.sketches);
  useStore((s) => s.view);
  useStore((s) => s.sketchPlanes);
  return planeTarget();
}

/** extent of the plane rectangle: the scene projected onto the plane, padded */
function planeRect(plane: SketchPlane, box: THREE.Box3) {
  const { u, v } = planeBasis(plane.orient);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    u0 = Math.min(u0, p.dot(u)); u1 = Math.max(u1, p.dot(u));
    v0 = Math.min(v0, p.dot(v)); v1 = Math.max(v1, p.dot(v));
  }
  const pu = Math.max((u1 - u0) * 0.12, 8);
  const pv = Math.max((v1 - v0) * 0.12, 8);
  return { u0: u0 - pu, u1: u1 + pu, v0: v0 - pv, v1: v1 + pv };
}

/** makes everything below it visible only to the preview camera (or to both) */
function useLayers(ref: React.RefObject<THREE.Object3D | null>, alsoMain: boolean) {
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      o.layers.set(INSET_LAYER);
      if (alsoMain) o.layers.enable(0);
    });
  });
}

/** the sketch plane (and a simple bed) as seen by the preview; in the 3D view the plane is shown in the main view too */
export function InsetScene() {
  const target = usePlaneTarget();
  const bodies = useStore((s) => s.doc.bodies);
  const bed = useStore((s) => s.doc.settings.bed);
  const view = useStore((s) => s.view);
  const dragging = useStore((s) => s.planeDrag);
  const meshes = useMeshes((s) => s.meshes);
  const sketches = useStore((s) => s.doc.sketches);
  const box = useMemo(() => sceneBox(), [bodies, meshes, sketches]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef<THREE.Group>(null);
  const plane = target?.plane;
  inset.active = !!target;

  const rect = useMemo(() => (plane ? planeRect(plane, box) : null), [plane?.orient, box]); // eslint-disable-line react-hooks/exhaustive-deps

  // fit the preview camera to scene + plane (not while dragging)
  if (plane && rect && !dragging) {
    const fit = box.clone();
    for (const [x, y] of [[rect.u0, rect.v0], [rect.u1, rect.v1]]) fit.expandByPoint(fromPlane2D(plane, x, y));
    const center = fit.getCenter(new THREE.Vector3());
    const radius = Math.max(fit.getSize(new THREE.Vector3()).length() / 2, 15);
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(FOV) / 2)) * 0.92;
    inset.target.copy(center);
    inset.position.copy(center).addScaledVector(VIEW_DIR.iso, dist);
  }

  const showInMain = view === "iso";
  useLayers(ref, false);
  const mainRef = useRef<THREE.Group>(null);
  useLayers(mainRef, true);

  const geom = useMemo(() => {
    if (!plane || !rect) return null;
    const corners = [
      [rect.u0, rect.v0],
      [rect.u1, rect.v0],
      [rect.u1, rect.v1],
      [rect.u0, rect.v1],
      [rect.u0, rect.v0],
    ].map(([x, y]) => fromPlane2D(plane, x, y).toArray() as Vec3);
    const quad = new THREE.BufferGeometry().setFromPoints(corners.slice(0, 4).map((c) => new THREE.Vector3(...c)));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const { n } = planeBasis(plane.orient);
    const center = fromPlane2D(plane, (rect.u0 + rect.u1) / 2, (rect.v0 + rect.v1) / 2);
    const arrowLen = Math.max(Math.min(rect.u1 - rect.u0, rect.v1 - rect.v0) * 0.25, 10);
    const tip = center.clone().addScaledVector(n, arrowLen);
    const tipQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    return { corners, quad, center, tip, tipQuat, arrowLen, color: AXIS_COLOR[PLANE_AXIS[plane.orient]] };
  }, [plane?.orient, plane?.value, rect]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geom?.quad.dispose(), [geom]);

  if (!geom) return null;
  const { corners, quad, center, tip, tipQuat, arrowLen, color } = geom;

  const planeContent = (
    <>
      <mesh geometry={quad} renderOrder={6}>
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={corners} color={color} lineWidth={1.6} transparent opacity={0.9} />
    </>
  );

  return (
    <>
      <group ref={ref}>
        {!showInMain && planeContent}
        {/* extrusion direction */}
        <Line points={[center.toArray() as Vec3, tip.toArray() as Vec3]} color={color} lineWidth={2} />
        <mesh position={tip} quaternion={tipQuat}>
          <coneGeometry args={[arrowLen * 0.12, arrowLen * 0.3, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {/* the real ground grid follows the main view, so the preview gets its own bed */}
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[bed.x, bed.y]} />
          <meshBasicMaterial color="#2b6cb0" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <Line
          points={[[-bed.x / 2, -bed.y / 2, 0], [bed.x / 2, -bed.y / 2, 0], [bed.x / 2, bed.y / 2, 0], [-bed.x / 2, bed.y / 2, 0], [-bed.x / 2, -bed.y / 2, 0]]}
          color="#4a7fc1"
          lineWidth={1}
        />
      </group>
      <group ref={mainRef}>{showInMain && planeContent}</group>
    </>
  );
}

/**
 * Takes over rendering: the main view as usual, then (when the plane preview is open)
 * the scene again from a fixed 3D angle into the preview's screen rectangle.
 */
export function InsetRenderer() {
  const cam = useMemo(() => {
    const c = new THREE.PerspectiveCamera(FOV, 1, 0.5, 100000);
    c.up.set(0, 0, 1);
    c.layers.enable(INSET_LAYER);
    return c;
  }, []);
  const clear = useMemo(() => new THREE.Color(), []);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    requestFrame = () => invalidate();
    return () => {
      requestFrame = null;
    };
  }, [invalidate]);

  useFrame((state) => {
    const { gl, scene, camera, size } = state;
    gl.render(scene, camera);
    if (!inset.active) return;
    const el = document.getElementById(INSET_ID);
    if (!el) return;
    const cr = gl.domElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const x = r.left - cr.left;
    const y = cr.bottom - r.bottom;

    cam.aspect = r.width / r.height;
    const dist = inset.position.distanceTo(inset.target);
    cam.near = Math.max(dist / 500, 0.1);
    cam.far = dist * 50;
    cam.position.copy(inset.position);
    cam.lookAt(inset.target);
    cam.updateProjectionMatrix();

    // gizmos, labels, grid etc. belong to the main view only
    const hidden: THREE.Object3D[] = [];
    for (const c of scene.children) {
      if (c.userData.noInset && c.visible) {
        c.visible = false;
        hidden.push(c);
      }
    }
    const autoClear = gl.autoClear;
    const prevAlpha = gl.getClearAlpha();
    gl.getClearColor(clear);
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setScissor(x, y, r.width, r.height);
    gl.setViewport(x, y, r.width, r.height);
    gl.setClearColor("#14171e", 1);
    gl.clear(true, true, false);
    gl.render(scene, cam);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor(clear, prevAlpha);
    gl.autoClear = autoClear;
    for (const c of hidden) c.visible = true;
  }, 1);
  return null;
}
