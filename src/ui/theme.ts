/**
 * One colour per kind of action, used for the tool rail, mode frame, context bar and panels.
 * Axis colours (X red, Y green, Z blue) live in lib/planes.ts.
 */
export const TOOL_COLOR = {
  select: "#cbd5e1",
  sketch: "#38bdf8",
  body: "#818cf8",
  edit: "#f97316",
  layflat: "#facc15",
  union: "#22c55e",
  subtract: "#f43f5e",
  intersect: "#a855f7",
  group: "#94a3b8",
  ungroup: "#94a3b8",
} as const;
