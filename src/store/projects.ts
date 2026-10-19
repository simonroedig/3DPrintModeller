import { create } from "zustand";
import type { Doc, Unit } from "../types";
import { idbDel, idbGet, idbSet } from "../lib/persist";
import { useMeshes } from "../cad/client";
import { captureThumbnail } from "../viewport/capture";
import { t } from "../i18n";
import {
  STORAGE_KEY,
  fitView,
  keepHeavyMeshesAsMesh,
  loadDocument,
  loadPhoneStandExample,
  loadSpeakerExample,
  newDocument,
  noEdit,
  normalizeDoc,
  syncAssets,
  toast,
  uid,
  useStore,
} from "./store";

/**
 * Several projects, all kept in the browser (IndexedDB): an index with name, info and a small
 * preview per project, plus one stored document per project. The open document is saved as you work.
 */
export interface ProjectMeta {
  id: string;
  name: string;
  created: number;
  updated: number;
  bodies: number;
  /** small JPEG data URL */
  thumb?: string;
}

interface ProjectIndex {
  current: string | null;
  list: ProjectMeta[];
}

const INDEX_KEY = "printmodeller.projects.v1";
const docKey = (id: string) => `printmodeller.project.${id}`;
const OPEN_KEY = "printmodeller.projectBar.open";

export const useProjects = create<{ list: ProjectMeta[]; current: string | null; ready: boolean; open: boolean }>(() => ({
  list: [],
  current: null,
  ready: false,
  open: readOpen(),
}));

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setProjectBarOpen(open: boolean) {
  useProjects.setState({ open });
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const P = useProjects.getState;
const getDoc = () => useStore.getState().doc;

let hydrated = false;
/** true while a stored document is being put into the editor (not a user change) */
let loading = false;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let thumbTimer: ReturnType<typeof setTimeout> | undefined;

function writeIndex() {
  const { list, current } = P();
  idbSet(INDEX_KEY, { list, current } satisfies ProjectIndex).catch(() => {});
}

function patchMeta(id: string, patch: Partial<ProjectMeta>) {
  useProjects.setState({ list: P().list.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  writeIndex();
}

function snapshotLocal(doc: Doc) {
  try {
    // small documents also go to localStorage: instant first paint and a fallback without IndexedDB
    if (doc.assets && Object.keys(doc.assets).length) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* quota */
  }
}

function nextProjectName(base = t("Project")) {
  const names = new Set(P().list.map((p) => p.name));
  for (let i = 1; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

/** makes sure there is a project to save into */
function ensureCurrent(): string {
  const cur = P().current;
  if (cur) return cur;
  const id = uid();
  const now = Date.now();
  useProjects.setState({ current: id, list: [{ id, name: nextProjectName(), created: now, updated: now, bodies: 0 }, ...P().list] });
  writeIndex();
  return id;
}

function saveNow() {
  clearTimeout(saveTimer);
  const id = ensureCurrent();
  const doc = getDoc();
  idbSet(docKey(id), doc).catch(() => toast(t("Saving in the browser failed (storage full?)"), "error"));
  snapshotLocal(doc);
  patchMeta(id, { updated: Date.now(), bodies: doc.bodies.length });
  dirty = false;
}

function refreshThumb() {
  clearTimeout(thumbTimer);
  const id = P().current;
  if (!id) return;
  // wait for the CAD kernel so the preview shows the finished geometry
  if (useMeshes.getState().busy) {
    thumbTimer = setTimeout(refreshThumb, 1200);
    return;
  }
  const thumb = captureThumbnail();
  if (thumb) patchMeta(id, { thumb });
}

useStore.subscribe((s, prev) => {
  if (s.doc === prev.doc || !hydrated || loading) return;
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(refreshThumb, 1500);
});

// leaving the page: write what is pending
window.addEventListener("pagehide", () => {
  if (dirty) saveNow();
});

/** stores the open project (document + fresh preview) before another one takes its place */
function flushCurrent() {
  const id = P().current;
  if (!id || !hydrated) return;
  clearTimeout(thumbTimer);
  if (dirty) saveNow();
  const thumb = captureThumbnail();
  if (thumb) patchMeta(id, { thumb });
}

function showDoc(doc: Doc) {
  loading = true;
  normalizeDoc(doc);
  syncAssets(doc);
  useStore.setState({
    doc: keepHeavyMeshesAsMesh(doc),
    past: [],
    future: [],
    selection: [],
    ...noEdit,
    groupFocus: null,
    tool: "select",
    startDialog: false,
    view: "iso",
  });
  loading = false;
  fitView();
}

/* ------------------------------------------------------------------ */
/* actions                                                              */
/* ------------------------------------------------------------------ */

export async function switchProject(id: string) {
  if (id === P().current) return;
  const meta = P().list.find((p) => p.id === id);
  const doc = await idbGet<Doc>(docKey(id)).catch(() => undefined);
  if (!meta || !doc || !Array.isArray(doc.bodies)) {
    toast(t("The project could not be loaded"), "error");
    return;
  }
  flushCurrent();
  useProjects.setState({ current: id });
  writeIndex();
  showDoc(doc);
  snapshotLocal(getDoc());
}

/**
 * Starts a new project (the open one stays saved). `fill` puts the content into the editor.
 * An untouched empty project is reused instead of piling up empty ones.
 */
function startProject(fill: () => void, name?: string) {
  const doc = getDoc();
  const cur = P().list.find((p) => p.id === P().current);
  const reuse = cur && !doc.bodies.length && !doc.sketches.length;
  if (!reuse) {
    flushCurrent();
    const id = uid();
    const now = Date.now();
    useProjects.setState({ current: id, list: [{ id, name: name ?? nextProjectName(), created: now, updated: now, bodies: 0 }, ...P().list] });
  } else if (name) patchMeta(cur.id, { name });
  writeIndex();
  fill();
  useStore.setState({ past: [], future: [] });
  saveNow();
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(refreshThumb, 1500);
}

export const createEmptyProject = (unit: Unit, snap?: number) => startProject(() => newDocument(unit, snap));
export const createExampleProject = (unit: Unit) => startProject(() => loadSpeakerExample(unit), t("Speaker wedge"));
export const createPhoneStandProject = (unit: Unit) => startProject(() => loadPhoneStandExample(unit), t("Phone stand"));
export const openDocumentAsProject = (doc: Doc, name: string) => startProject(() => loadDocument(doc), name);

export function renameProject(id: string, name: string) {
  const n = name.trim();
  if (n) patchMeta(id, { name: n });
}

export async function duplicateProject(id: string) {
  const src = P().list.find((p) => p.id === id);
  if (!src) return;
  if (id === P().current && dirty) saveNow();
  const doc = id === P().current ? getDoc() : await idbGet<Doc>(docKey(id)).catch(() => undefined);
  if (!doc) return;
  const copy: ProjectMeta = { ...src, id: uid(), name: t("{name} (copy)", { name: src.name }), created: Date.now(), updated: Date.now() };
  await idbSet(docKey(copy.id), doc);
  const list = [...P().list];
  list.splice(list.indexOf(src) + 1, 0, copy);
  useProjects.setState({ list });
  writeIndex();
  toast(t("“{name}” created", { name: copy.name }));
}

export async function deleteProject(id: string) {
  const meta = P().list.find((p) => p.id === id);
  if (!meta) return;
  if (!window.confirm(t("Delete project “{name}” permanently?", { name: meta.name }))) return;
  const list = P().list.filter((p) => p.id !== id);
  idbDel(docKey(id)).catch(() => {});
  if (id !== P().current) {
    useProjects.setState({ list });
    writeIndex();
    return;
  }
  clearTimeout(saveTimer);
  dirty = false;
  useProjects.setState({ list, current: null });
  const next = list[0];
  if (next) {
    const doc = await idbGet<Doc>(docKey(next.id)).catch(() => undefined);
    if (doc) {
      useProjects.setState({ current: next.id });
      writeIndex();
      showDoc(doc);
      snapshotLocal(getDoc());
      return;
    }
  }
  writeIndex();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  useStore.setState({ startDialog: true });
}

/* ------------------------------------------------------------------ */
/* start-up                                                             */
/* ------------------------------------------------------------------ */

function legacyLocal(): Doc | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Doc) : undefined;
  } catch {
    return undefined;
  }
}

const valid = (d: Doc | undefined): d is Doc => !!d && Array.isArray(d.bodies) && !!d.settings;

async function hydrate() {
  let index = await idbGet<ProjectIndex>(INDEX_KEY).catch(() => undefined);
  if (!index) {
    // earlier versions kept a single document: it becomes the first project
    index = { current: null, list: [] };
    const legacy = (await idbGet<Doc>(STORAGE_KEY).catch(() => undefined)) ?? legacyLocal();
    if (valid(legacy) && (legacy.bodies.length || legacy.sketches?.length)) {
      const id = uid();
      const now = Date.now();
      await idbSet(docKey(id), legacy).catch(() => {});
      index = { current: id, list: [{ id, name: t("My project"), created: now, updated: now, bodies: legacy.bodies.length }] };
      await idbSet(INDEX_KEY, index).catch(() => {});
    }
  }
  const doc = index.current ? await idbGet<Doc>(docKey(index.current)).catch(() => undefined) : undefined;
  useProjects.setState({ list: index.list, current: valid(doc) ? index.current : null, ready: true });
  hydrated = true;
  if (valid(doc)) {
    showDoc(doc);
    // the very first preview of migrated projects
    if (!index.list.find((p) => p.id === index.current)?.thumb) thumbTimer = setTimeout(refreshThumb, 2500);
  } else {
    useStore.setState({ startDialog: true });
  }
}

hydrate().catch(() => {
  hydrated = true;
  useProjects.setState({ ready: true });
  useStore.setState({ startDialog: true });
});
