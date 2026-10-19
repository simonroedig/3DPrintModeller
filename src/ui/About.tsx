import type { ReactNode } from "react";
import { ExternalLink, Printer, Ruler, Shapes, SquaresSubtract } from "lucide-react";
import { TOOL_COLOR } from "./theme";
import { APP_NAME, AUTHOR, AUTHOR_URL, REPO_URL, TAGLINE } from "./brand";
import { Logo } from "./Logo";

const HIGHLIGHTS: { icon: ReactNode; color: string; title: string; text: string }[] = [
  {
    icon: <Shapes size={16} />,
    color: TOOL_COLOR.body,
    title: "Intuitiv wie Tinkercad",
    text: "Grundkörper einfügen, an Pfeilen ziehen. Teile rasten aneinander und am Druckbett ein.",
  },
  {
    icon: <Ruler size={16} />,
    color: TOOL_COLOR.sketch,
    title: "Präzise wie CAD",
    text: "Skizzen in jeder Ebene, exakte Maße, echte Rundungen und Fasen auf einem OpenCascade-Kern.",
  },
  {
    icon: <SquaresSubtract size={16} />,
    color: TOOL_COLOR.subtract,
    title: "Boolesche Operationen",
    text: "Vereinen, Abziehen, Schnittmenge: nicht-destruktiv, alle Teile bleiben änderbar.",
  },
  {
    icon: <Printer size={16} />,
    color: TOOL_COLOR.layflat,
    title: "Gemacht für den Druck",
    text: "Export als 3MF, STL oder STEP, Import von STEP, STL, 3MF und OBJ. Alles im Browser.",
  },
];

export const STACK = ["React 19", "TypeScript", "Three.js / R3F", "OpenCascade (WASM)", "Web Worker", "Zustand", "Tailwind CSS"];

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

/** what 3DPrintModeller is and why it exists: welcome screen and "Über 3DPrintModeller" */
export function Pitch({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <BrandHeader />
      <div className="text-[15px] text-ink-100 leading-snug">{TAGLINE}</div>
      <p className="text-[12.5px] text-ink-300 leading-relaxed">
        Für meine 3D-Druck-Projekte gab es keine Software, die genau auf meine Bedürfnisse zugeschnitten war: Tinkercad ist intuitiv, stößt aber
        schnell an Grenzen. Shapr3D ist mächtig, für ein schnelles Druckteil aber oft zu viel. <b className="text-ink-100">{APP_NAME}</b> verbindet
        beides: intuitives Bauen mit einfachen Grundkörpern und echte CAD-Werkzeuge für die komplexen Teile.
      </p>
      <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} className="rounded-lg border border-ink-750 bg-ink-900/70 p-2.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-100">
              <span className="w-6 h-6 rounded-md grid place-items-center" style={{ background: `${h.color}26`, color: h.color }}>
                {h.icon}
              </span>
              {h.title}
            </div>
            <div className="text-[11.5px] text-ink-400 mt-1.5 leading-snug">{h.text}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STACK.map((t) => (
          <span key={t} className="text-[10.5px] px-2 py-0.5 rounded-full border border-ink-700 text-ink-300">
            {t}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-400">
        <span>
          Entworfen & entwickelt von <b className="text-ink-200">{AUTHOR}</b>
        </span>
        <a className="flex items-center gap-1 text-sky-400 hover:text-sky-300" href={AUTHOR_URL} target="_blank" rel="noreferrer">
          {AUTHOR_URL.replace(/^https?:\/\//, "")} <ExternalLink size={12} />
        </a>
        <a className="flex items-center gap-1 text-sky-400 hover:text-sky-300" href={REPO_URL} target="_blank" rel="noreferrer">
          Quellcode <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
