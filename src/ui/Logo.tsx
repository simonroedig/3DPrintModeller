/** isometric cube in the axis colours (Z top, Y front-left, X front-right) with hints of print layers */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3 28 9.5 16 16 4 9.5z" fill="#60a5fa" />
      <path d="M16 16v13L4 22.5v-13z" fill="#22c55e" />
      <path d="M16 16 28 9.5v13L16 29z" fill="#ef4444" />
      <path
        d="M4 14l12 6.5M4 18.3l12 6.5M28 14l-12 6.5M28 18.3l-12 6.5"
        stroke="#0b0d12"
        strokeOpacity="0.28"
        strokeWidth="0.9"
        fill="none"
      />
      <path d="M16 3 28 9.5 16 16 4 9.5z" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}
