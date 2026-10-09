import { create } from "zustand";
import type { Body, Feature, ExportFormat, ExportQuality, MeshData, Shape } from "../types";
import type { AssetPayload, ImportedPartInfo, WorkerRequest, WorkerResponse } from "./worker";

export type MeshEntry = { mesh?: MeshData; error?: string };

interface MeshState {
  ready: boolean;
  busy: number;
  meshes: Record<string, MeshEntry>;
}

export const useMeshes = create<MeshState>(() => ({ ready: false, busy: 0, meshes: {} }));

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

let reqCounter = 1;
const resolvers = new Map<number, (r: WorkerResponse) => void>();

/** latest wanted geometry per "slot" (usually a body id) — older wishes get dropped */
const wanted = new Map<string, { key: string; shape: Shape; features: Feature[] }>();
const inflightKeys = new Set<string>();
let inflight = 0;
const order: string[] = [];

worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
  const msg = ev.data;
  if (msg.type === "ready") {
    useMeshes.setState({ ready: true });
    pump();
    return;
  }
  if (msg.type === "mesh") {
    inflight--;
    inflightKeys.delete(msg.key);
    const meshes = { ...useMeshes.getState().meshes, [msg.key]: { mesh: msg.mesh, error: msg.error } };
    order.push(msg.key);
    while (order.length > 300) {
      const old = order.shift()!;
      if (!order.includes(old)) delete meshes[old];
    }
    useMeshes.setState({ meshes, busy: inflight + wanted.size });
    pump();
    return;
  }
  const r = resolvers.get(msg.reqId);
  if (r) {
    resolvers.delete(msg.reqId);
    r(msg);
  }
};

function pump() {
  if (!useMeshes.getState().ready) return;
  while (inflight < 1 && wanted.size) {
    const [slot, job] = wanted.entries().next().value!;
    wanted.delete(slot);
    if (useMeshes.getState().meshes[job.key] || inflightKeys.has(job.key)) continue;
    inflight++;
    inflightKeys.add(job.key);
    const req: WorkerRequest = { type: "mesh", reqId: reqCounter++, key: job.key, shape: job.shape, features: job.features };
    worker.postMessage(req);
  }
  useMeshes.setState({ busy: inflight + wanted.size });
}

export function requestMesh(slot: string, key: string, shape: Shape, features: Feature[]) {
  if (useMeshes.getState().meshes[key] || inflightKeys.has(key)) {
    wanted.delete(slot);
    return;
  }
  wanted.delete(slot);
  wanted.set(slot, { key, shape, features });
  pump();
}

function call<T extends WorkerResponse>(req: Extract<WorkerRequest, { reqId: number }>): Promise<T> {
  return new Promise((resolve) => {
    resolvers.set(req.reqId, resolve as (r: WorkerResponse) => void);
    worker.postMessage(req);
  });
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

/** Makes an imported file known to the worker (before any body using it gets meshed). */
export function registerAsset(id: string, payload: AssetPayload) {
  if (registeredAssets.has(id)) return;
  registeredAssets.add(id);
  worker.postMessage({ type: "asset", id, payload } satisfies WorkerRequest);
}

export function isAssetRegistered(id: string) {
  return registeredAssets.has(id);
}

/** Converts an imported file into solids; resolves with the bounds of each solid. */
export async function importAsset(id: string, payload: AssetPayload): Promise<ImportedPartInfo[]> {
  registeredAssets.add(id);
  useMeshes.setState({ busy: useMeshes.getState().busy + 1 });
  try {
    const res = await call<Extract<WorkerResponse, { type: "import" }>>({ type: "import", reqId: reqCounter++, id, payload });
    if (res.error || !res.parts) {
      registeredAssets.delete(id);
      throw new Error(res.error ?? "Import fehlgeschlagen");
    }
    return res.parts;
  } finally {
    useMeshes.setState({ busy: Math.max(0, useMeshes.getState().busy - 1) });
  }
}
