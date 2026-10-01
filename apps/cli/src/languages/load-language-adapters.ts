// Owns what a command does when the parser is missing: carry on without import relations.
import type { LanguageAdapter } from "@codeheat/engine";
import { Console, Effect } from "effect";

import { escapeForTerminal } from "../output/escape.js";
import { LanguageAdapters } from "./language-adapters.js";
import type { ParserUnavailable } from "./language-adapters.js";

const noteUnavailable = ({ reason }: ParserUnavailable): Effect.Effect<[]> =>
  Console.error(
    `codeheat: the code parser is unavailable (${escapeForTerminal(reason)}); import relations are not reported`,
  ).pipe(Effect.as([]));

/**
 * The adapters to analyze with. When the parser is unavailable it says so once
 * on stderr and returns none: every other result of the analysis stays, only
 * the import relations are unknown (`null`).
 */
export const loadLanguageAdapters: Effect.Effect<
  ReadonlyArray<LanguageAdapter>
> = Effect.gen(function* () {
  const load = yield* LanguageAdapters;
  return yield* Effect.catchTag(load, "ParserUnavailable", noteUnavailable);
});
