import { useState } from "react";
import { t, useLang } from "./i18n";
import { FileUp } from "lucide-react";
import { importFiles, useStore } from "./store/store";
import { Viewport } from "./viewport/Viewport";
import { StatusBar, ToolRail, TopBar, ViewSwitcher } from "./ui/Chrome";
import { Sidebar } from "./ui/Sidebar";
import { DragHud, EmptyHint, KernelLoading, ModeFrame, Toasts, ToolOptions } from "./ui/Overlays";
import { AboutDialog, ExportDialog, HelpDialog, StartDialog } from "./ui/Dialogs";
import { useShortcuts } from "./ui/shortcuts";
import { TooltipLayer } from "./ui/Tooltip";
import { PlanePanel } from "./ui/PlanePanel";
import { ProjectBar } from "./ui/ProjectBar";
import { ContextBar } from "./ui/ContextBar";

export function App() {
  useShortcuts();
  // a language switch re-renders the whole interface
  useLang((s) => s.lang);
  const startDialog = useStore((s) => s.startDialog);
  const exportOpen = useStore((s) => s.exportOpen);
  const helpOpen = useStore((s) => s.helpOpen);
  const aboutOpen = useStore((s) => s.aboutOpen);
  const [dragOver, setDragOver] = useState(false);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  return (
    <div
      className="h-full flex flex-col"
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragOver(false);
        importFiles([...e.dataTransfer.files]);
      }}
    >
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <ToolRail />
        <main className="relative flex-1 min-w-0 overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
          <Viewport />
          <ModeFrame />
          <EmptyHint />
          <ToolOptions />
          <ViewSwitcher />
          <PlanePanel />
          <DragHud />
          <ContextBar />
          <KernelLoading />
          <Toasts />
        </main>
        <Sidebar />
      </div>
      <ProjectBar />
      <StatusBar />
      {startDialog && <StartDialog />}
      {exportOpen && <ExportDialog />}
      {helpOpen && <HelpDialog />}
      {aboutOpen && <AboutDialog />}
      <TooltipLayer />
      {dragOver && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 pointer-events-none">
          <div className="overlay-card !border-sky-400 px-8 py-6 text-center">
            <FileUp size={32} className="mx-auto mb-2 text-sky-400" />
            <div className="text-[15px] font-semibold">{t("Drop file here")}</div>
            <div className="text-ink-400 text-[12px] mt-1">{t("STEP (recommended), STL, 3MF or OBJ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
