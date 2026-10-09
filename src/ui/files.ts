import type { Doc } from "../types";
import { loadDocument, toast, useStore } from "../store/store";

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
  download(JSON.stringify({ app: "PrintModeller", version: 1, doc }, null, 1), "projekt.pmodel.json", "application/json");
}

export function openProject() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.pmodel,application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const doc: Doc = data.doc ?? data;
      if (!Array.isArray(doc.bodies) || !doc.settings) throw new Error("format");
      loadDocument(doc);
      toast(`„${file.name}“ geöffnet`);
    } catch {
      toast("Datei konnte nicht gelesen werden", "error");
    }
  };
  input.click();
}
