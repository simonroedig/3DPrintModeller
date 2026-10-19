import { Fragment, createElement, type ReactNode } from "react";
import { create } from "zustand";
import { DE, DE_PATTERNS } from "./de";

/**
 * Tiny i18n: the code carries the English text, `de/*.ts` map it to German.
 * `t()` reads the current language at call time; the app re-renders as a whole when it changes.
 */
export type Lang = "en" | "de";

const LANG_KEY = "printmodeller.lang";

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

export const useLang = create<{ lang: Lang }>(() => ({ lang: readLang() }));

export const getLang = () => useLang.getState().lang;

export function setLang(lang: Lang) {
  useLang.setState({ lang });
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

if (typeof document !== "undefined") document.documentElement.lang = readLang();

/** BCP 47 locale for numbers and dates */
export const locale = () => (getLang() === "de" ? "de-DE" : "en-US");

type Vars = Record<string, string | number>;

const missing = new Set<string>();

/**
 * A key may carry a context before a "|" when one English word needs two German ones,
 * e.g. "name|Union" (a body called "Vereinigung") versus "Union" (the button "Vereinen").
 */
const plain = (key: string) => key.slice(key.indexOf("|") + 1);

function lookup(key: string): string {
  if (getLang() === "en") return plain(key);
  const hit = DE[key];
  if (hit !== undefined) return hit;
  if (import.meta.env.DEV && !missing.has(key)) {
    missing.add(key);
    console.warn(`[i18n] missing German text for: ${JSON.stringify(key)}`);
  }
  return plain(key);
}

function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** translate a fixed English text; `{name}` placeholders are filled from `vars` */
export function t(key: string, vars?: Vars): string {
  return fill(lookup(key), vars);
}

/** like `t`, but placeholders may be React elements (e.g. a <kbd>) and keep their place in either language */
export function tn(key: string, vars: Record<string, ReactNode>): ReactNode {
  const parts = lookup(key).split(/(\{\w+\})/g);
  return createElement(
    Fragment,
    null,
    ...parts.map((p, i) => {
      const m = /^\{(\w+)\}$/.exec(p);
      return createElement(Fragment, { key: i }, m && m[1] in vars ? vars[m[1]] : p);
    }),
  );
}

/**
 * Messages built elsewhere at runtime (e.g. by the CAD worker, which does not know the language):
 * exact matches first, then the patterns in de/patterns.ts.
 */
export function tMsg(msg: string): string {
  if (getLang() === "en") return msg;
  const hit = DE[msg];
  if (hit !== undefined) return hit;
  for (const [re, to] of DE_PATTERNS) {
    if (re.test(msg)) return msg.replace(re, (...args: string[]) => to.replace(/\$(\d)/g, (_, n: string) => tMsgPart(args[Number(n)] ?? "")));
  }
  return msg;
}

/** pattern captures may themselves be translatable words ("Fillet" → "Rundung") */
function tMsgPart(s: string) {
  return DE[s] ?? s;
}

/** subscribe a component to language changes and get `t` */
export function useT() {
  useLang((s) => s.lang);
  return t;
}
