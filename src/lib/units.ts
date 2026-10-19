import type { Unit } from "../types";
import { getLang } from "../i18n";

/** decimal separator of the current language */
const dec = (s: string) => (getLang() === "de" ? s.replace(".", ",") : s);
/** snap option whose label follows the language ("0.5 mm" / "0,5 mm") */
const opt = (num: string, unit: string, mm: number) => ({
  get label() {
    return `${dec(num)} ${unit}`;
  },
  mm,
});

export const UNIT_FACTOR: Record<Unit, number> = { mm: 1, cm: 10, in: 25.4 };
export const UNIT_LABEL: Record<Unit, string> = { mm: "mm", cm: "cm", in: "in" };

export const SNAP_OPTIONS: Record<Unit, { label: string; mm: number }[]> = {
  mm: [opt("0.1", "mm", 0.1), opt("0.5", "mm", 0.5), opt("1", "mm", 1), opt("2", "mm", 2), opt("5", "mm", 5), opt("10", "mm", 10)],
  cm: [opt("0.1", "cm", 1), opt("0.5", "cm", 5), opt("1", "cm", 10)],
  in: [opt("1/32", "in", 25.4 / 32), opt("1/16", "in", 25.4 / 16), opt("1/8", "in", 25.4 / 8), opt("1/4", "in", 25.4 / 4), opt("1", "in", 25.4)],
};

export const DEFAULT_SNAP: Record<Unit, number> = { mm: 1, cm: 10, in: 25.4 / 16 };

const DIGITS: Record<Unit, number> = { mm: 2, cm: 3, in: 3 };

export function toUnit(mm: number, unit: Unit) {
  return mm / UNIT_FACTOR[unit];
}

export function fromUnit(v: number, unit: Unit) {
  return v * UNIT_FACTOR[unit];
}

/** number in display unit, trimmed ("12.5", "3") */
export function fmtNum(mm: number, unit: Unit, digits = DIGITS[unit]) {
  const v = toUnit(mm, unit);
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return dec(String(Object.is(r, -0) ? 0 : r));
}

export function fmtLen(mm: number, unit: Unit, digits?: number) {
  return `${fmtNum(mm, unit, digits)} ${UNIT_LABEL[unit]}`;
}

/**
 * Parses user input like "12,5", "100/3", "2cm + 4", "(20-2)*2" into millimetres.
 * Numbers without suffix are interpreted in the current display unit.
 */
export function parseLen(input: string, unit: Unit): number | null {
  const src = input.trim().replace(/,/g, ".").toLowerCase();
  if (!src) return null;
  let i = 0;
  const peek = () => src[i];
  const skip = () => {
    while (src[i] === " ") i++;
  };
  const number = (): number | null => {
    skip();
    const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    let v = parseFloat(m[0]);
    skip();
    const u = /^(mm|cm|m|in|")/.exec(src.slice(i));
    if (u) {
      i += u[0].length;
      const f = u[0] === "mm" ? 1 : u[0] === "cm" ? 10 : u[0] === "m" ? 1000 : 25.4;
      v = v * f;
    } else {
      v = fromUnit(v, unit);
    }
    return v;
  };
  // factors in multiplication are unit-less except the first operand
  const factor = (asScalar: boolean): number | null => {
    skip();
    if (peek() === "-") {
      i++;
      const v = factor(asScalar);
      return v === null ? null : -v;
    }
    if (peek() === "(") {
      i++;
      const v = expr(asScalar);
      skip();
      if (peek() !== ")") return null;
      i++;
      return v;
    }
    if (asScalar) {
      skip();
      const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (!m) return null;
      i += m[0].length;
      return parseFloat(m[0]);
    }
    return number();
  };
  const term = (asScalar: boolean): number | null => {
    let v = factor(asScalar);
    if (v === null) return null;
    for (;;) {
      skip();
      const op = peek();
      if (op !== "*" && op !== "/") return v;
      i++;
      const r = factor(true);
      if (r === null) return null;
      v = op === "*" ? v * r : v / r;
    }
  };
  const expr = (asScalar: boolean): number | null => {
    let v = term(asScalar);
    if (v === null) return null;
    for (;;) {
      skip();
      const op = peek();
      if (op !== "+" && op !== "-") return v;
      i++;
      const r = term(asScalar);
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
  };
  const v = expr(false);
  skip();
  if (v === null || i !== src.length || !Number.isFinite(v)) return null;
  return v;
}

export function parseNumber(input: string): number | null {
  const v = Number(input.trim().replace(",", "."));
  return Number.isFinite(v) && input.trim() !== "" ? v : null;
}

export function snapTo(v: number, step: number) {
  if (!step) return v;
  return Math.round(v / step) * step;
}
