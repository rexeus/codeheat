// Owns the one diagnostic for history a shallow clone does not have.
import type { Report } from "@codeheat/engine";
import { Console, Effect } from "effect";

/** Prints a one-line warning to stderr when the report was made from a shallow clone. */
export const warnIfShallow = (report: Report): Effect.Effect<void> =>
  report.repository.shallow
    ? Console.error(
        "codeheat: shallow clone: history before its oldest fetched commit is missing; run git fetch --unshallow for full results",
      )
    : Effect.void;
