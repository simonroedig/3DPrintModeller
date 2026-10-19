import type { ReactNode } from "react";
import { ExternalLink, Printer, Ruler, Shapes, SquaresSubtract } from "lucide-react";
import { TOOL_COLOR } from "./theme";
import { APP_NAME, AUTHOR, AUTHOR_URL, REPO_URL, TAGLINE } from "./brand";
import { Logo } from "./Logo";
import { t, tn } from "../i18n";

const HIGHLIGHTS: { icon: ReactNode; color: string; title: string; text: string }[] = [
  {
    icon: <Shapes size={16} />,
    color: TOOL_COLOR.body,
    title: "Intuitive like Tinkercad",
    text: "Drop in primitives and drag the arrows. Parts snap to each other and to the print bed.",
  },
  {
    icon: <Ruler size={16} />,
    color: TOOL_COLOR.sketch,
    title: "Precise like CAD",
    text: "Sketches on any plane, exact dimensions, real fillets and chamfers on an OpenCascade kernel.",
  },
  {
    icon: <SquaresSubtract size={16} />,
    color: TOOL_COLOR.subtract,
    title: "Boolean operations",
    text: "Union, subtract, intersect: non-destructive, so every part stays editable.",
  },
  {
    icon: <Printer size={16} />,
    color: TOOL_COLOR.layflat,
    title: "Made for printing",
    text: "Export to 3MF, STL or STEP, import STEP, STL, 3MF and OBJ. All right in your browser.",
  },
];

/** the technology behind the app; `what` is the tooltip that explains each chip */
export const STACK: { name: string; what: string }[] = [
  { name: "React 19", what: "UI framework that builds the interface from components" },
  { name: "TypeScript", what: "JavaScript with static types, catches bugs during development" },
  { name: "Three.js + React Three Fiber", what: "3D rendering in the browser, written as React components" },
  { name: "OpenCascade CAD kernel (WebAssembly)", what: "The CAD kernel that computes solids, fillets and booleans, compiled to run in the browser" },
  { name: "Web Worker", what: "Runs the CAD kernel in the background so the interface stays smooth" },
  { name: "Zustand (state management)", what: "Small library that holds the app state: document, selection, undo/redo" },
  { name: "Tailwind CSS", what: "Utility-first CSS framework used for all styling" },
];

export function BrandHeader({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={size} />
      <div>
        <div className="text-[22px] font-semibold tracking-tight leading-tight text-white">{APP_NAME}</div>
        <a className="text-ink-400 text-[12.5px] hover:text-sky-300" href={AUTHOR_URL} target="_blank" rel="noreferrer">
          by {AUTHOR}
        </a>
      </div>
    </div>
  );
}

/** what 3DPrintModeller is and why it exists: welcome screen and "About 3DPrintModeller" */
export function Pitch({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <BrandHeader />
      <div className="text-[15px] text-ink-100 leading-snug">{t(TAGLINE)}</div>
      <p className="text-[12.5px] text-ink-300 leading-relaxed">
        {tn(
          "For my 3D printing projects, I couldn't find any software tailored to my needs. Tinkercad is intuitive but quickly hits its limits. Shapr3D is powerful, but often overkill for a quick print part. {app} combines both: intuitive building with simple primitives, plus real CAD tools for the complex parts.",
          { app: <b className="text-ink-100">{APP_NAME}</b> },
        )}
      </p>
      <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} className="rounded-lg border border-ink-750 bg-ink-900/70 p-2.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-100">
              <span className="w-6 h-6 rounded-md grid place-items-center" style={{ background: `${h.color}26`, color: h.color }}>
                {h.icon}
              </span>
              {t(h.title)}
            </div>
            <div className="text-[11.5px] text-ink-400 mt-1.5 leading-snug">{t(h.text)}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] text-ink-500 mr-0.5">{t("Built with")}</span>
        {STACK.map((s) => (
          <span key={s.name} title={t(s.what)} className="text-[10.5px] px-2 py-0.5 rounded-full border border-ink-700 text-ink-300 cursor-help">
            {t(s.name)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-400">
        <span>{tn("Designed & developed by {author}", { author: <b className="text-ink-200">{AUTHOR}</b> })}</span>
        <a className="flex items-center gap-1 text-sky-400 hover:text-sky-300" href={AUTHOR_URL} target="_blank" rel="noreferrer">
          {AUTHOR_URL.replace(/^https?:\/\//, "")} <ExternalLink size={12} />
        </a>
        <a className="flex items-center gap-1 text-sky-400 hover:text-sky-300" href={REPO_URL} target="_blank" rel="noreferrer">
          {t("Source code")} <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
