import { useEffect, useRef } from "react";

/** isometric cube in the app's blue */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="#3b82f6" />
      <path d="M16 3 28 9.5 16 16 4 9.5z" fill="#93c5fd" />
      <path d="M16 16v13L4 22.5v-13z" fill="#1d4ed8" />
    </svg>
  );
}

/**
 * The logo as a real 3D cube (CSS 3D). Hovering its `.brand` / `.cube-hover` container plays one
 * smooth half turn while the faces glide apart and settle back, like an exploded CAD view.
 * The motion always finishes (no snapping back when the mouse leaves) and only animates transforms.
 */
export function CubeLogo({ size = 40 }: { size?: number }) {
  const s = Math.round(size * 0.58);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const host = scene.closest(".brand, .cube-hover") ?? scene;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let running = false;
    const play = () => {
      if (running || reduce?.matches || !scene.animate) return;
      running = true;
      const D = 1400;
      const h = s / 2;
      const gap = s * 0.24;
      const cube = scene.querySelector(".cube3d") as HTMLElement;
      const spin = cube.animate(
        [{ transform: "rotateX(-35.264deg) rotateY(-45deg)" }, { transform: "rotateX(-35.264deg) rotateY(-225deg)" }],
        { duration: D, easing: "cubic-bezier(0.6, 0, 0.2, 1)" },
      );
      scene.querySelectorAll<HTMLElement>(".cube3d-fi").forEach((f) =>
        f.animate(
          [
            { transform: `translateZ(${h}px)`, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
            { transform: `translateZ(${h + gap}px)`, offset: 0.4, easing: "cubic-bezier(0.55, 0, 0.25, 1)" },
            { transform: `translateZ(${h}px)` },
          ],
          { duration: D },
        ),
      );
      scene.animate(
        [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-1px) scale(1.07)", offset: 0.4 }, { transform: "translateY(0) scale(1)" }],
        { duration: D, easing: "ease-in-out" },
      );
      scene
        .querySelector(".cube3d-glow")
        ?.animate([{ opacity: 0.6 }, { opacity: 1, offset: 0.4 }, { opacity: 0.6 }], { duration: D, easing: "ease-in-out" });
      spin.onfinish = spin.oncancel = () => {
        running = false;
      };
    };
    host.addEventListener("mouseenter", play);
    return () => host.removeEventListener("mouseenter", play);
  }, [s]);

  return (
    <span ref={ref} className="cube3d-scene" style={{ width: size, height: size, ["--s" as string]: `${s}px` }} aria-hidden>
      <span className="cube3d-glow" />
      <span className="cube3d">
        {["top", "bottom", "front", "back", "right", "left"].map((f) => (
          <span key={f} className={`cube3d-f ${f}`}>
            <span className="cube3d-fi" />
          </span>
        ))}
      </span>
    </span>
  );
}
