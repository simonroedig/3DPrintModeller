/** small icons in the lucide style (24 grid, round strokes) for tools lucide has no picture for */

const svg = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/** three parts in a row, with the step between them */
export function LinearPatternIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...svg(size)}>
      <circle cx="4.5" cy="10" r="2.5" />
      <circle cx="12" cy="10" r="2.5" />
      <circle cx="19.5" cy="10" r="2.5" />
      <path d="M4.5 18h15M4.5 16.5v3M19.5 16.5v3" strokeWidth={1.6} />
    </svg>
  );
}

/** six parts around a centre */
export function CircularPatternIcon({ size = 16 }: { size?: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    return [12 + Math.cos(a) * 8, 12 + Math.sin(a) * 8];
  });
  return (
    <svg {...svg(size)}>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.1" />
      ))}
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** open polyline with its points: the line tool */
export function LineToolIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...svg(size)}>
      <path d="M4 19 8.5 6 15 13.5 20 5" />
      <circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
