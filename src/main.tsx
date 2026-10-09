import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { useStore } from "./store/store";
import { useMeshes } from "./cad/client";

if (import.meta.env.DEV) Object.assign(window, { __pm: { useStore, useMeshes } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
