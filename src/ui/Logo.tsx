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
