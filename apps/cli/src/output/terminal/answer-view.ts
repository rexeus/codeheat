// Owns the first line of the terminal's `analyze` view: the answer of report v2.
import type { Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import type { Style } from "./style.js";

/** The answer in its one sentence (`answer.summary`), bold, then a blank line. */
export const answerLines = (
  { answer }: Report,
  style: Style,
): ReadonlyArray<string> => [style.bold(escapeForTerminal(answer.summary)), ""];
