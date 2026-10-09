import { useEffect } from "react";
import { applyEdit, clearEditSelection } from "../store/edit";
import {
  copySelection,
  deleteSelection,
  duplicateSelection,
  fitView,
  groupSelection,
  paste,
  redo,
  rotateSelection,
  select,
  selectedBodies,
  setTool,
  setView,
  translateBodies,
  undo,
  ungroupSelection,
  updateBodies,
  useStore,
} from "../store/store";
import type { Vec3 } from "../types";
import { openProject, saveProject } from "./files";

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const s = useStore.getState();
      if (s.startDialog || s.exportOpen || s.helpOpen) {
        if (e.key === "Escape") useStore.setState({ exportOpen: false, helpOpen: false, startDialog: s.doc.bodies.length || s.doc.sketches.length ? false : s.startDialog });
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod) {
        const handled = () => e.preventDefault();
        if (k === "z") (e.shiftKey ? redo : undo)(), handled();
        else if (k === "y") redo(), handled();
        else if (k === "d") duplicateSelection(), handled();
        else if (k === "c") copySelection();
        else if (k === "v") paste(), handled();
        else if (k === "g") (e.shiftKey ? ungroupSelection : groupSelection)(), handled();
        else if (k === "s") saveProject(), handled();
        else if (k === "o") openProject(), handled();
        else if (k === "a") select(s.doc.bodies.filter((b) => !b.hidden).map((b) => b.id)), handled();
        return;
      }
      if (e.altKey) return;
      const sel = selectedBodies();
      const step = (s.doc.settings.snap || 1) * (e.shiftKey ? 10 : 1);
      const nudge = (d: Vec3) => {
        if (!sel.length) return;
        e.preventDefault();
        translateBodies(
          sel.map((b) => b.id),
          d,
        );
      };
      const vertical = s.view === "front" || s.view === "right";
      switch (e.key) {
        case "Escape":
          if (s.tool === "edit" && (s.edgeSel || s.faceSel)) clearEditSelection();
          else if (s.tool !== "select") setTool("select");
          else select([]);
          return;
        case "Delete":
        case "Backspace":
          if (s.tool === "edit" && (s.edgeSel || s.faceSel)) clearEditSelection();
          else deleteSelection();
          e.preventDefault();
          return;
        case "Enter":
          if (s.tool === "edit") applyEdit();
          return;
        case "ArrowLeft":
          return nudge(s.view === "right" ? [0, -step, 0] : [-step, 0, 0]);
        case "ArrowRight":
          return nudge(s.view === "right" ? [0, step, 0] : [step, 0, 0]);
        case "ArrowUp":
          return nudge(vertical ? [0, 0, step] : [0, step, 0]);
        case "ArrowDown":
          return nudge(vertical ? [0, 0, -step] : [0, -step, 0]);
        case "PageUp":
          return nudge([0, 0, step]);
        case "PageDown":
          return nudge([0, 0, -step]);
        case "?":
          useStore.setState({ helpOpen: true });
          return;
      }
      switch (k) {
        case "v":
          setTool("select");
          break;
        case "r":
          setTool("rect");
          break;
        case "c":
          setTool("circle");
          break;
        case "p":
          setTool("poly");
          break;
        case "f":
          setTool("edit");
          break;
        case "l":
          setTool("layflat");
          break;
        case "1":
          setView("iso");
          break;
        case "2":
          setView("top");
          break;
        case "3":
          setView("front");
          break;
        case "4":
          setView("right");
          break;
        case "0":
          fitView();
          break;
        case "q":
          rotateSelection(2, 90);
          break;
        case "e":
          rotateSelection(2, -90);
          break;
        case "h":
          if (sel.length) updateBodies(Object.fromEntries(sel.map((b) => [b.id, { hole: !b.hole }])));
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
