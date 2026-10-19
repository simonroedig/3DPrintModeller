import type { Doc } from "../types";
import { IMPORT_ACCEPT, importFiles, toast, useStore } from "../store/store";
import { openDocumentAsProject, useProjects } from "../store/projects";
import { detectFormat } from "../cad/importers";

export function download(data: Uint8Array | string, filename: string, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function saveProject() {
  const doc = useStore.getState().doc;
  const { list, current } = useProjects.getState();
  const name = list.find((p) => p.id === current)?.name ?? "projekt";
  const file = name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "projekt";
  download(JSON.stringify({ app: "3DPrintModeller", version: 1, name, doc }, null, 1), `${file}.pmodel.json`, "application/json");
}

export function pickImportFiles() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = IMPORT_ACCEPT;
  input.onchange = () => {
    if (input.files?.length) importFiles([...input.files]);
  };
  input.click();
}

export function openProject() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = `.json,.pmodel,application/json,${IMPORT_ACCEPT}`;
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (detectFormat(file.name)) {
      importFiles([file]);
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      const doc: Doc = data.doc ?? data;
      if (!Array.isArray(doc.bodies) || !doc.settings) throw new Error("format");
      // opened files become a project of their own
      openDocumentAsProject(doc, typeof data.name === "string" ? data.name : file.name.replace(/(\.pmodel)?\.json$/i, ""));
      toast(`„${file.name}“ als Projekt geöffnet`);
    } catch {
      toast("Datei konnte nicht gelesen werden", "error");
    }
  };
  input.click();
}
