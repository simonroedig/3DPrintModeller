import { useStore } from "./store/store";
import { Viewport } from "./viewport/Viewport";
import { StatusBar, ToolRail, TopBar, ViewSwitcher } from "./ui/Chrome";
import { Sidebar } from "./ui/Sidebar";
import { DragHud, EmptyHint, KernelLoading, Toasts, ToolOptions } from "./ui/Overlays";
import { ExportDialog, HelpDialog, StartDialog } from "./ui/Dialogs";
import { useShortcuts } from "./ui/shortcuts";

export function App() {
  useShortcuts();
  const startDialog = useStore((s) => s.startDialog);
  const exportOpen = useStore((s) => s.exportOpen);
  const helpOpen = useStore((s) => s.helpOpen);
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <ToolRail />
        <main className="relative flex-1 min-w-0 overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
          <Viewport />
          <EmptyHint />
          <ToolOptions />
          <ViewSwitcher />
          <DragHud />
          <KernelLoading />
          <Toasts />
        </main>
        <Sidebar />
      </div>
      <StatusBar />
      {startDialog && <StartDialog />}
      {exportOpen && <ExportDialog />}
      {helpOpen && <HelpDialog />}
    </div>
  );
}
