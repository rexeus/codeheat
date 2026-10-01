// Owns the one diagnostic for `--entry` globs that select nothing.
import type { Report } from "@codeheat/engine";
import { Console, Effect } from "effect";

/**
 * Prints a one-line warning to stderr when `--entry` globs were given but no
 * module has an entry point, so a mistyped glob does not pass for a stable
 * interface. `report` must not be cut to `--limit`: a module beyond the limit
 * could hold the match.
 */
export const warnIfEntryMatchedNothing = (
  report: Report,
  entry: ReadonlyArray<string>,
): Effect.Effect<void> =>
  entry.length > 0 && report.modules.every((m) => m.entryPoints.length === 0)
    ? Console.error(
        "codeheat: --entry matched no file of the analysis universe",
      )
    : Effect.void;
