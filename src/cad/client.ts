import { create } from "zustand";
import type { Body, Feature, ExportFormat, ExportQuality, MeshData, Shape } from "../types";
import type { AssetPayload, ImportedPartInfo, WorkerRequest, WorkerResponse } from "./worker";
import { meshBodyData } from "./meshBody";

export type MeshEntry = { mesh?: MeshData; error?: string };

interface MeshState {
  ready: boolean;
  busy: number;
  meshes: Record<string, MeshEntry>;
}

export const useMeshes = create<MeshState>(() => ({ ready: false, busy: 0, meshes: {} }));

let worker: Worker;
let generation = 0;
let reqCounter = 1;
const resolvers = new Map<number, (r: WorkerResponse) => void>();

/** latest wanted geometry per "slot" (usually a body id); older wishes get dropped */
const wanted = new Map<string, { key: string; shape: Shape; features: Feature[] }>();
const inflightKeys = new Set<string>();
let inflight = 0;
const order: string[] = [];
/** time of the last sign of life while the worker had work to do */
let lastProgress = Date.now();

function outstanding() {
  return inflight + resolvers.size;
}

function setMesh(key: string, entry: MeshEntry) {
  const meshes = { ...useMeshes.getState().meshes, [key]: entry };
  order.push(key);
  while (order.length > 300) {
    const old = order.shift()!;
    if (!order.includes(old)) delete meshes[old];
  }
  useMeshes.setState({ meshes });
}

function startWorker() {
  const gen = ++generation;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    if (gen !== generation) return;
    lastProgress = Date.now();
    const msg = ev.data;
    if (msg.type === "ready") {
      useMeshes.setState({ ready: true });
      pump();
      return;
    }
    if (msg.type === "mesh") {
      inflight--;
      inflightKeys.delete(msg.key);
      setMesh(msg.key, { mesh: msg.mesh, error: msg.error });
      useMeshes.setState({ busy: inflight + wanted.size + resolvers.size });
      pump();
      return;
    }
    const r = resolvers.get(msg.reqId);
    if (r) {
      resolvers.delete(msg.reqId);
      r(msg);
      useMeshes.setState({ busy: inflight + wanted.size + resolvers.size });
    }
  };
}
startWorker();

function post(req: WorkerRequest) {
  if (outstanding() === 0) lastProgress = Date.now();
  worker.postMessage(req);
}

function pump() {
  if (!useMeshes.getState().ready) return;
  while (inflight < 1 && wanted.size) {
    const [slot, job] = wanted.entries().next().value!;
    wanted.delete(slot);
    if (useMeshes.getState().meshes[job.key] || inflightKeys.has(job.key)) continue;
    post({ type: "mesh", reqId: reqCounter++, key: job.key, shape: job.shape, features: job.features });
    inflight++;
    inflightKeys.add(job.key);
  }
  useMeshes.setState({ busy: inflight + wanted.size + resolvers.size });
}

export function requestMesh(slot: string, key: string, shape: Shape, features: Feature[]) {
  if (useMeshes.getState().meshes[key] || inflightKeys.has(key)) {
    wanted.delete(slot);
    return;
  }
  // large imported meshes are displayed straight from their triangles (no CAD kernel involved)
  if (shape.kind === "imported" && shape.mode === "mesh") {
    wanted.delete(slot);
    const payload = assetPayloads.get(shape.asset);
    const part = payload?.format === "mesh" ? payload.parts[shape.part] : undefined;
    if (!part) {
      setMesh(key, { error: "Importierte Datei fehlt" });
      return;
    }
    try {
      setMesh(key, { mesh: meshBodyData(part, shape.scale) });
    } catch (err) {
      setMesh(key, { error: String((err as Error).message ?? err) });
    }
    return;
  }
  wanted.delete(slot);
  wanted.set(slot, { key, shape, features });
  pump();
}

function call<T extends WorkerResponse>(req: Extract<WorkerRequest, { reqId: number }>): Promise<T> {
  return new Promise((resolve) => {
    resolvers.set(req.reqId, resolve as (r: WorkerResponse) => void);
    post(req);
    useMeshes.setState({ busy: inflight + wanted.size + resolvers.size });
  });
}

/** How long the kernel has been working without finishing anything (ms), 0 when idle. */
export function stalledFor() {
  return outstanding() ? Date.now() - lastProgress : 0;
}

let onRestart: (() => void) | null = null;
/** called after the worker had to be restarted (to re-send imported files) */
export function setRestartHandler(fn: () => void) {
  onRestart = fn;
}

/** Aborts whatever the CAD kernel is doing by restarting it. */
export function cancelWork() {
  generation++;
  worker.terminate();
  for (const [reqId, resolve] of resolvers) resolve({ type: "export", reqId, error: "Abgebrochen" });
  resolvers.clear();
  for (const key of inflightKeys) setMesh(key, { error: "Berechnung abgebrochen" });
  inflightKeys.clear();
  inflight = 0;
  wanted.clear();
  registeredAssets.clear();
  useMeshes.setState({ ready: false, busy: 0 });
  startWorker();
  onRestart?.();
}

export async function exportModel(bodies: Body[], format: ExportFormat, quality: ExportQuality, separate: boolean) {
  const res = await call<Extract<WorkerResponse, { type: "export" }>>({
    type: "export",
    reqId: reqCounter++,
    bodies,
    format,
    quality,
    separate,
  });
  if (res.error || !res.data) throw new Error(res.error ?? "Export fehlgeschlagen");
  return { data: res.data, volume: res.volume ?? 0 };
}

export async function computeVolume(bodies: Body[]) {
  const res = await call<Extract<WorkerResponse, { type: "volume" }>>({ type: "volume", reqId: reqCounter++, bodies });
  if (res.error) throw new Error(res.error);
  return res.volume ?? 0;
}

/* ------------------------------------------------------------------ */
/* imported files                                                       */
/* ------------------------------------------------------------------ */

const registeredAssets = new Set<string>();
const assetPayloads = new Map<string, AssetPayload>();

/** Makes an imported file known to the worker (before any body using it gets meshed). */
export function registerAsset(id: string, payload: AssetPayload) {
  assetPayloads.set(id, payload);
  if (registeredAssets.has(id)) return;
  registeredAssets.add(id);
  post({ type: "asset", id, payload });
}

export function isAssetRegistered(id: string) {
  return registeredAssets.has(id);
}

export function assetPayload(id: string) {
  return assetPayloads.get(id);
}

/** Converts an imported file into CAD solids; resolves with the bounds of each solid. */
export async function importAsset(id: string, payload: AssetPayload): Promise<ImportedPartInfo[]> {
  assetPayloads.set(id, payload);
  registeredAssets.add(id);
  const res = await call<Extract<WorkerResponse, { type: "import" }>>({ type: "import", reqId: reqCounter++, id, payload });
  if (res.error || !res.parts) {
    if (res.error !== "Abgebrochen") registeredAssets.delete(id);
    throw new Error(res.error ?? "Import fehlgeschlagen");
  }
  return res.parts;
}
