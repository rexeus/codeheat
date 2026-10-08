// Owns the diagnostics for history a shallow clone does not have.
import type { Analysis } from "@codeheat/engine";
import { Console, Effect } from "effect";

/**
 * Prints a one-line warning to stderr when the report was made from a shallow
 * clone, and a second one when a comparison's previous window reaches past the
 * oldest fetched commit, since that comparison is incomplete.
 */
export const warnIfShallow = (report: Analysis): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (!report.repository.shallow) {
      return;
    }
    yield* Console.error(
      "codeheat: shallow clone: history before its oldest fetched commit is missing; run git fetch --unshallow for full results",
    );
    if (report.comparison?.previousTruncated === true) {
      yield* Console.error(
        "codeheat: shallow clone: the previous window reaches past the oldest fetched commit, so the comparison is incomplete",
      );
    }
  });
