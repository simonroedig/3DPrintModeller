import ui from "./ui";
import sidebar from "./sidebar";
import dialogs from "./dialogs";
import core from "./core";
import { patterns } from "./patterns";

/** English text → German text */
export const DE: Record<string, string> = { ...core, ...ui, ...sidebar, ...dialogs };

/** German versions of runtime messages with values in them; `$1`… refer to the capture groups */
export const DE_PATTERNS: [RegExp, string][] = patterns;
