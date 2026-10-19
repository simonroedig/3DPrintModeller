import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { PlaneOrient, SketchPlane, Vec3 } from "../types";
import { planeTarget, useStore } from "../store/store";
import { useMeshes } from "../cad/client";
import { AXIS_COLOR, fromPlane2D, planeBasis, PLANE_AXIS, VIEW_DIR, viewAxis } from "../lib/planes";
import { sceneBox } from "./CameraRig";
import { t, useLang } from "../i18n";

/** DOM element the plane preview is drawn into (see ui/PlanePanel) */
export const INSET_ID = "plane-inset-view";
const INSET_LAYER = 1;
const FOV = 30;
/** distance of the eye from the scene centre, in scene radii */
const EYE_DIST = 1.15;

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
  const showBed = useStore((s) => s.showBed);
  // the preview shows up while sketching and in every 2D view (there it tells you where you look from)
  inset.active = !!target || view !== "iso";
  const eyeOrient = view !== "iso" ? view : (plane?.orient ?? null);

  const rect = useMemo(() => (plane ? planeRect(plane, box) : null), [plane?.orient, box]); // eslint-disable-line react-hooks/exhaustive-deps

  // fit the preview camera to scene + plane + eye (not while dragging)
  if (inset.active && !dragging) {
    const fit = box.clone();
    if (plane && rect) for (const [x, y] of [[rect.u0, rect.v0], [rect.u1, rect.v1]]) fit.expandByPoint(fromPlane2D(plane, x, y));
    if (eyeOrient) {
      const reach = box.getSize(new THREE.Vector3()).length() / 2;
      const eye = box.getCenter(new THREE.Vector3()).addScaledVector(VIEW_DIR[eyeOrient], reach * EYE_DIST);
      // room for the eye badge around its position
      fit.expandByPoint(eye.clone().addScalar(reach * 0.3));
      fit.expandByPoint(eye.clone().addScalar(-reach * 0.3));
    }
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
  const bedRef = useRef<THREE.Group>(null);
  useLayers(bedRef, false);

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

  if (!inset.active) return null;

  const planeContent = geom && (
    <>
      <mesh geometry={geom.quad} renderOrder={6}>
        <meshBasicMaterial color={geom.color} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={geom.corners} color={geom.color} lineWidth={1.6} transparent opacity={0.9} />
    </>
  );

  return (
    <>
      <group ref={ref}>
        {!showInMain && planeContent}
        {geom && (
          <>
            {/* extrusion direction */}
            <Line points={[geom.center.toArray() as Vec3, geom.tip.toArray() as Vec3]} color={geom.color} lineWidth={2} />
            <mesh position={geom.tip} quaternion={geom.tipQuat}>
              <coneGeometry args={[geom.arrowLen * 0.12, geom.arrowLen * 0.3, 12]} />
              <meshBasicMaterial color={geom.color} />
            </mesh>
          </>
        )}
        {eyeOrient && <ViewEye orient={eyeOrient} box={box} plane={plane && rect ? { plane, rect } : null} />}
      </group>
      {/* the real ground grid follows the main view, so the preview gets its own bed */}
      <group ref={bedRef} visible={showBed}>
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

const EYE_LABEL: Record<PlaneOrient, string> = { top: "Top", bottom: "Bottom", front: "Front", back: "Back", left: "Left", right: "Right" };

/** round badge with an eye and the name of the side you look from */
function eyeTexture(color: string, label: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 330;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(128, 116, 104, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.stroke();
  // almond
  g.beginPath();
  g.moveTo(42, 116);
  g.quadraticCurveTo(128, 30, 214, 116);
  g.quadraticCurveTo(128, 202, 42, 116);
  g.fillStyle = "#ffffff";
  g.fill();
  // iris + pupil + highlight
  g.beginPath();
  g.arc(128, 116, 38, 0, Math.PI * 2);
  g.fillStyle = "#0f172a";
  g.fill();
  g.beginPath();
  g.arc(128, 116, 17, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.beginPath();
  g.arc(141, 103, 9, 0, Math.PI * 2);
  g.fillStyle = "#ffffff";
  g.fill();
  g.font = "700 58px Inter, system-ui, sans-serif";
  g.textAlign = "center";
  g.lineWidth = 10;
  g.strokeStyle = "rgba(10,12,16,0.9)";
  g.strokeText(label, 128, 300);
  g.fillStyle = "#ffffff";
  g.fillText(label, 128, 300);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * An eye on the side you look from, with its sight lines onto what you see:
 * the sketch plane while sketching, otherwise the window of the 2D view (it follows pan and zoom).
 */
function ViewEye({
  orient,
  box,
  plane,
}: {
  orient: PlaneOrient;
  box: THREE.Box3;
  plane: { plane: SketchPlane; rect: ReturnType<typeof planeRect> } | null;
}) {
  const axis = PLANE_AXIS[orient];
  const color = AXIS_COLOR[axis];
  const lang = useLang((s) => s.lang);
  const tex = useMemo(() => eyeTexture(color, t(EYE_LABEL[orient])), [color, orient, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
    return g;
  }, []);
  useEffect(() => () => lines.dispose(), [lines]);
  const spriteRef = useRef<THREE.Sprite>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const reach = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 10);
  const dir = VIEW_DIR[orient];

  useFrame((state) => {
    const center = box.getCenter(new THREE.Vector3());
    const corners: THREE.Vector3[] = [];
    if (plane) {
      const { rect } = plane;
      for (const [x, y] of [[rect.u0, rect.v0], [rect.u1, rect.v0], [rect.u1, rect.v1], [rect.u0, rect.v1]]) corners.push(fromPlane2D(plane.plane, x, y));
    } else {
      // visible window of the 2D view, on the near side of the scene, kept to a sensible size
      const cam = state.camera as THREE.OrthographicCamera;
      const va = viewAxis(orient);
      if (!cam.isOrthographicCamera || va === null) return;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const limit = reach * 1.05;
      const hw = Math.min((cam.right - cam.left) / 2 / cam.zoom, limit);
      const hh = Math.min((cam.top - cam.bottom) / 2 / cam.zoom, limit);
      const c = cam.position.clone();
      const near = (dir.getComponent(va) > 0 ? box.max : box.min).getComponent(va);
      c.setComponent(va, near + dir.getComponent(va) * reach * 0.04);
      // keep the window around the scene even when panned far away
      for (let a = 0; a < 3; a++) if (a !== va) c.setComponent(a, THREE.MathUtils.clamp(c.getComponent(a), center.getComponent(a) - limit, center.getComponent(a) + limit));
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push(c.clone().addScaledVector(right, sx * hw).addScaledVector(up, sy * hh));
    }
    const mid = corners.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(0.25);
    // the eye keeps a fixed distance from the scene centre along the view axis (so the preview frames it)
    const eye = mid.clone();
    eye.setComponent(axis, center.getComponent(axis));
    eye.addScaledVector(dir, reach * EYE_DIST);
    const pos = lines.getAttribute("position") as THREE.BufferAttribute;
    let i = 0;
    const put = (a: THREE.Vector3, b: THREE.Vector3) => {
      pos.setXYZ(i++, a.x, a.y, a.z);
      pos.setXYZ(i++, b.x, b.y, b.z);
    };
    for (let k = 0; k < 4; k++) put(eye, corners[k]);
    for (let k = 0; k < 4; k++) put(corners[k], corners[(k + 1) % 4]);
    put(eye, mid);
    pos.needsUpdate = true;
    lines.computeBoundingSphere();
    const s = spriteRef.current;
    if (s) {
      s.position.copy(eye);
      s.scale.set(reach * 0.5, reach * 0.5 * (330 / 256), 1);
    }
    const cone = coneRef.current;
    if (cone) {
      cone.position.copy(mid).addScaledVector(dir, reach * 0.12);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
      cone.scale.setScalar(reach * 0.06);
    }
  });

  return (
    <>
      <lineSegments geometry={lines} renderOrder={40} frustumCulled={false}>
        <lineBasicMaterial color={color} transparent opacity={0.85} depthTest={false} depthWrite={false} />
      </lineSegments>
      <mesh ref={coneRef} renderOrder={41} frustumCulled={false}>
        <coneGeometry args={[0.7, 2, 16]} />
        <meshBasicMaterial color={color} depthTest={false} transparent />
      </mesh>
      <sprite ref={spriteRef} renderOrder={42} frustumCulled={false}>
        <spriteMaterial map={tex} depthTest={false} depthWrite={false} transparent />
      </sprite>
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
