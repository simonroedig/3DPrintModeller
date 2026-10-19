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
 * The logo as a real 3D cube (CSS 3D). Inside a `.brand` element it spins once on hover
 * and briefly spreads its faces apart, like an exploded CAD view.
 */
export function CubeLogo({ size = 40 }: { size?: number }) {
  const s = Math.round(size * 0.58);
  return (
    <span className="cube3d-scene" style={{ width: size, height: size, ["--s" as string]: `${s}px` }} aria-hidden>
      <span className="cube3d">
        <span className="cube3d-f top" />
        <span className="cube3d-f bottom" />
        <span className="cube3d-f front" />
        <span className="cube3d-f back" />
        <span className="cube3d-f right" />
        <span className="cube3d-f left" />
      </span>
    </span>
  );
}
