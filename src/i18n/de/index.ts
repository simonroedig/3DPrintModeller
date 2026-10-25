import ui from "./ui";
import sidebar from "./sidebar";
import dialogs from "./dialogs";
import core from "./core";
import mobile from "./mobile";
import tools from "./tools";
import { patterns } from "./patterns";

/** English text → German text */
export const DE: Record<string, string> = { ...core, ...ui, ...sidebar, ...dialogs, ...mobile, ...tools };

/** German versions of runtime messages with values in them; `$1`… refer to the capture groups */
export const DE_PATTERNS: [RegExp, string][] = patterns;
