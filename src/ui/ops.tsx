import type { ReactNode } from "react";
import { Group, SquaresIntersect, SquaresSubtract, SquaresUnite } from "lucide-react";
import type { BoolOp } from "../types";

/** the ways to combine bodies, in menu order (English texts, rendered with t()) */
export const OPS: { op: BoolOp; label: string; short: string; icon: (size: number) => ReactNode; tip: string; kbd?: string }[] = [
  {
    op: "union",
    label: "Union",
    short: "Union",
    icon: (s) => <SquaresUnite size={s} />,
    tip: "Merge into one body. Holes are subtracted, the joining edges can be filleted",
    kbd: "Ctrl G",
  },
  {
    op: "subtract",
    label: "Subtract",
    short: "Subtract",
    icon: (s) => <SquaresSubtract size={s} />,
    tip: "Subtract all other bodies from the first one selected. The cutting bodies are kept and stay editable",
  },
  {
    op: "intersect",
    label: "Intersection",
    short: "Intersect",
    icon: (s) => <SquaresIntersect size={s} />,
    tip: "Keep only the volume that all selected bodies share",
  },
  {
    op: "group",
    // "op|": the button says "Gruppieren" in German, a body of this kind is a "Gruppe"
    label: "op|Group",
    short: "Group",
    icon: (s) => <Group size={s} />,
    tip: "Just bundle them (move and scale together), the parts stay separate volumes",
  },
];
