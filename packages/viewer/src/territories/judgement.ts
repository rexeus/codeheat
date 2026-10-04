import type { Report } from "@codeheat/engine";

import type { Territory } from "./territory-index.js";

/** The limits of the report that decide whether a territory has enough to judge. */
export type JudgementLimits = Pick<
  Report["thresholds"],
  "maxCommitFiles" | "minModuleCommits"
>;

/**
 * What can be said about how well a territory contains its changes: its
 * `containment` when there is enough to judge, otherwise `null` with the
 * `reason`, in plain words.
 */
export type Judgement =
  | { readonly containment: number; readonly reason: null }
  | { readonly containment: null; readonly reason: string };

const notJudged = (reason: string): Judgement => ({
  containment: null,
  reason,
});

/**
 * Judges the containment of `territory`. Test code is not judged. A territory
 * with no counted change either saw no change at all or changed only in
 * changes of more than `maxCommitFiles` files, which the engine does not count
 * for spread; one with fewer than `minModuleCommits` counted changes has too
 * few for its share to mean anything.
 */
export const judgeTerritory = (
  territory: Territory,
  { maxCommitFiles, minModuleCommits }: JudgementLimits,
): Judgement => {
  const containment = territory.fit?.containment ?? null;
  if (territory.kind === "tests") {
    return notJudged("test code is not judged");
  }
  if (territory.changes === 0 && territory.heatShare > 0) {
    return notJudged(
      `changed only in changes of more than ${maxCommitFiles} files, which are not judged`,
    );
  }
  if (containment === null) {
    return notJudged("no counted changes in this window");
  }
  if (territory.changes < minModuleCommits) {
    return notJudged(`too few changes to judge (${territory.changes})`);
  }
  return { containment, reason: null };
};
