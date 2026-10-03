// Owns what classifies and groups the commits of one span the way reading
// just that span would.
import { Effect } from "effect";

import { readMerges } from "../changes/merges.js";
import { classify } from "../mechanical/classify.js";
import type { Evidence } from "../mechanical/classify.js";
import { evidenceWithin } from "../mechanical/evidence.js";
import type { Entry } from "./scan.js";

/**
 * The classifier of the commits of `span`, read from the log from `since` on:
 * the `evidence` for a longer read narrowed to the span (see
 * `evidenceWithin`), which says which commits are mechanical, and the merge
 * commits from `since` on, whose graph decides which pull request owns a
 * commit.
 */
export const classifierFor = (
  evidence: Evidence,
  span: ReadonlyArray<Entry>,
  since: string,
) =>
  Effect.gen(function* () {
    const narrowed = yield* evidenceWithin(
      evidence,
      span.map(({ signals }) => signals),
    );
    const merges = yield* readMerges({ since });
    return {
      merges,
      kindsOf: (window: ReadonlyArray<Entry>) =>
        classify(
          window.map(({ signals }) => signals),
          narrowed,
        ),
    };
  });
