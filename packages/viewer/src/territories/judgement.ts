import type { Report } from "@codeheat/engine";

import type { Territory } from "./territory-index.js";

/** The limits of the report that decide whether a territory has enough to judge, and where it leaks. */
export type JudgementLimits = Pick<
  Report["thresholds"],
  "maxCommitFiles" | "minModuleCommits" | "maxEntryContainment"
>;

/**
 * How a territory holds up: it `leaks` (at most `maxEntryContainment` of its
 * changes stay inside, and another territory shares changes with it), it
 * `holds`, or it is `unjudged`, with the `reason` in a few plain words.
 */
export type Standing =
  | { readonly kind: "leaks"; readonly containment: number }
  | { readonly kind: "holds"; readonly containment: number }
  | { readonly kind: "unjudged"; readonly reason: string };

const unjudged = (reason: string): Standing => ({ kind: "unjudged", reason });

/** How a territory with enough changes holds up: a leak needs a partner to leak to. */
const boundaryStanding = (
  territory: Territory,
  containment: number,
  limit: number,
): Standing => {
  if (containment > limit) {
    return { kind: "holds", containment };
  }
  return (territory.fit?.partner ?? null) === null
    ? unjudged("no partner to leak to")
    : { kind: "leaks", containment };
};

/**
 * Judges `territory` by the engine's boundary gate. Test code and leftover
 * files are not judged. A territory with no counted change either saw no
 * change at all or changed only in changes of more than `maxCommitFiles`
 * files, which the engine does not count for spread; one with fewer than
 * `minModuleCommits` counted changes has too few for its share to mean
 * anything. A territory that keeps little inside but shares changes with no
 * other one says nothing about where it leaks, so it is not judged either.
 */
export const standingOf = (
  territory: Territory,
  { maxCommitFiles, minModuleCommits, maxEntryContainment }: JudgementLimits,
): Standing => {
  const containment = territory.fit?.containment ?? null;
  if (territory.kind === "tests") {
    return unjudged("test code");
  }
  if (territory.kind === "other") {
    return unjudged("leftover files");
  }
  if (territory.changes === 0 && territory.heatShare > 0) {
    return unjudged(`only in changes of over ${maxCommitFiles} files`);
  }
  if (containment === null) {
    return unjudged("no counted changes");
  }
  if (territory.changes < minModuleCommits) {
    return unjudged("too few changes");
  }
  return boundaryStanding(territory, containment, maxEntryContainment);
};
