import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { isSmallScreen, MobileGate } from "./ui/MobileGate";

const root = createRoot(document.getElementById("root")!);

/** loads the modeller itself (incl. the CAD kernel) only when it is going to be used */
function boot() {
  void import("./App").then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
  if (import.meta.env.DEV) {
    void Promise.all([import("./store/store"), import("./cad/client")]).then(([s, c]) =>
      Object.assign(window, { __pm: { useStore: s.useStore, useMeshes: c.useMeshes } }),
    );
  }
}

if (isSmallScreen()) {
  root.render(
    <StrictMode>
      <MobileGate onContinue={boot} />
    </StrictMode>,
  );
} else {
  boot();
}
