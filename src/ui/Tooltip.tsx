import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Tip {
  text: string;
  kbd?: string;
  x: number;
  y: number;
  place: "right" | "below" | "above";
}

/**
 * One consistent, quick tooltip for every element with a `title` (or `data-tip`) attribute.
 * Native titles are converted on first hover so the slow browser tooltip never shows.
 * A trailing "(Kürzel)" in the text is rendered as a key hint.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;

    const show = (el: HTMLElement) => {
      const raw = el.getAttribute("data-tip");
      if (!raw || !el.isConnected) return;
      const m = /^(.*\S)\s+\(([^()]{1,18})\)$/.exec(raw);
      const r = el.getBoundingClientRect();
      const rail = el.closest(".tool-rail");
      const inRail = !!rail;
      const railRight = rail?.getBoundingClientRect().right ?? r.right;
      const nearBottom = r.bottom > window.innerHeight - 70;
      setTip({
        text: m ? m[1] : raw,
        kbd: m ? m[2] : undefined,
        place: inRail ? "right" : nearBottom ? "above" : "below",
        // centred tips stay inside the window (they are at most 300 px wide)
        x: inRail ? railRight + 8 : Math.min(Math.max(r.left + r.width / 2, 158), window.innerWidth - 158),
        y: inRail ? r.top + r.height / 2 : nearBottom ? r.top - 8 : r.bottom + 8,
      });
    };

    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[title],[data-tip]") as HTMLElement | null;
      if (el === current) return;
      clearTimeout(timer);
      setTip(null);
      current = el;
      if (!el) return;
      const title = el.getAttribute("title");
      if (title) el.setAttribute("data-tip", title);
      if (el.hasAttribute("title")) el.removeAttribute("title");
      if (el.getAttribute("data-tip")) timer = setTimeout(() => show(el), 380);
    };
    const hide = () => {
      clearTimeout(timer);
      setTip(null);
      current = null;
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("wheel", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("wheel", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  if (!tip) return null;
  const transform =
    tip.place === "right" ? "translate(0, -50%)" : tip.place === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)";
  return createPortal(
    <div className="app-tooltip" style={{ left: tip.x, top: tip.y, transform }}>
      {tip.text}
      {tip.kbd && <kbd>{tip.kbd}</kbd>}
    </div>,
    document.body,
  );
}
