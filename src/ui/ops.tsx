import type { ReactNode } from "react";
import { Group, SquaresIntersect, SquaresSubtract, SquaresUnite } from "lucide-react";
import type { BoolOp } from "../types";

/** the ways to combine bodies, in menu order */
export const OPS: { op: BoolOp; label: string; short: string; icon: (size: number) => ReactNode; tip: string; kbd?: string }[] = [
  {
    op: "union",
    label: "Vereinen",
    short: "Vereinen",
    icon: (s) => <SquaresUnite size={s} />,
    tip: "Zu einem Körper verschmelzen. Löcher werden abgezogen, Übergangskanten lassen sich runden",
    kbd: "Strg G",
  },
  {
    op: "subtract",
    label: "Abziehen",
    short: "Abziehen",
    icon: (s) => <SquaresSubtract size={s} />,
    tip: "Vom zuerst gewählten Körper alle weiteren abziehen. Die Werkzeuge bleiben erhalten und änderbar",
  },
  {
    op: "intersect",
    label: "Schnittmenge",
    short: "Schnitt",
    icon: (s) => <SquaresIntersect size={s} />,
    tip: "Nur das Volumen behalten, das alle gewählten Körper gemeinsam haben",
  },
  {
    op: "group",
    label: "Gruppieren",
    short: "Gruppe",
    icon: (s) => <Group size={s} />,
    tip: "Nur zusammenfassen (gemeinsam verschieben/skalieren), Teile bleiben getrennte Volumen",
  },
];
