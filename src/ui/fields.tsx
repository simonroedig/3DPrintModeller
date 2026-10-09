import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store/store";
import { fmtNum, parseLen, parseNumber, snapTo, UNIT_LABEL } from "../lib/units";

function useDraft(display: string) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(null);
  }, [display]);
  return { value: draft ?? display, setDraft, focused };
}

/** Length input in the document unit. Accepts expressions like "120/2" or "3cm". */
export function LenField({
  label,
  mm,
  onChange,
  min = -Infinity,
  title,
  suffix,
}: {
  label?: ReactNode;
  mm: number;
  onChange: (mm: number) => void;
  min?: number;
  title?: string;
  suffix?: string;
}) {
  const unit = useStore((s) => s.doc.settings.unit);
  const snap = useStore((s) => s.doc.settings.snap);
  const display = fmtNum(mm, unit);
  const { value, setDraft, focused } = useDraft(display);
  const [bad, setBad] = useState(false);

  const commit = (text: string) => {
    const v = parseLen(text, unit);
    if (v === null || v < min) {
      setBad(true);
      setTimeout(() => setBad(false), 600);
      setDraft(null);
      return;
    }
    if (Math.abs(v - mm) > 1e-9) onChange(v);
    setDraft(null);
  };

  return (
    <label className="field" title={title} style={bad ? { borderColor: "#ef4444" } : undefined}>
      {label && <span className="lbl">{label}</span>}
      <input
        value={value}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={(e) => {
          focused.current = false;
          commit(e.currentTarget.value);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step = (snap || 1) * (e.shiftKey ? 10 : 1);
            const next = snapTo(mm + (e.key === "ArrowUp" ? step : -step), step);
            if (next >= min) onChange(next);
          }
        }}
      />
      <span className="unit">{suffix ?? UNIT_LABEL[unit]}</span>
    </label>
  );
}

/** Plain number input (degrees, counts …). */
export function NumField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  digits = 2,
  min = -Infinity,
  max = Infinity,
}: {
  label?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  digits?: number;
  min?: number;
  max?: number;
}) {
  const r = Math.round(value * 10 ** digits) / 10 ** digits;
  const display = String(Object.is(r, -0) ? 0 : r).replace(".", ",");
  const { value: v, setDraft, focused } = useDraft(display);
  const commit = (text: string) => {
    const n = parseNumber(text);
    setDraft(null);
    if (n === null) return;
    const c = Math.min(max, Math.max(min, n));
    if (Math.abs(c - value) > 1e-9) onChange(c);
  };
  return (
    <label className="field">
      {label && <span className="lbl">{label}</span>}
      <input
        value={v}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={(e) => {
          focused.current = false;
          commit(e.currentTarget.value);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const s = step * (e.shiftKey ? 10 : 1);
            onChange(Math.min(max, Math.max(min, value + (e.key === "ArrowUp" ? s : -s))));
          }
        }}
      />
      {suffix && <span className="unit">{suffix}</span>}
    </label>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  accent,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  accent?: boolean;
}) {
  return (
    <div className={`seg ${accent ? "accent" : ""}`}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
