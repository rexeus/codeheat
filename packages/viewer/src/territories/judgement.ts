import type { Report } from "@codeheat/engine";

import type { Territory } from "./territory-index.js";

/**
 * How a territory holds up: it `leaks` or `holds` as the engine judged it for
 * the verdict (`Report.verdict`), or it is `unjudged`, with the `reason` in a
 * few plain words.
 */
export type Standing =
  | { readonly kind: "leaks"; readonly containment: number }
  | { readonly kind: "holds"; readonly containment: number }
  | { readonly kind: "unjudged"; readonly reason: string };

const unjudged = (reason: string): Standing => ({ kind: "unjudged", reason });

/**
 * Why the engine did not judge `territory`. Test code and leftover files are
 * not judged. A territory with no counted change either saw no change at all
 * or changed only in changes of more than `maxCommitFiles` files, which the
 * engine does not count for spread; one with fewer than `minModuleCommits`
 * counted changes has too few for its share to mean anything. Any other one
 * keeps little inside but shares changes with no other territory, which says
 * nothing about where it leaks.
 */
const whyUnjudged = (
  territory: Territory,
  { maxCommitFiles, minModuleCommits }: Report["thresholds"],
): Standing => {
  if (territory.kind === "tests") {
    return unjudged("test code");
  }
  if (territory.kind === "other") {
    return unjudged("leftover files");
  }
  if (territory.changes === 0 && territory.heatShare > 0) {
    return unjudged(`only in changes of over ${maxCommitFiles} files`);
  }
  if ((territory.fit?.containment ?? null) === null) {
    return unjudged("no counted changes");
  }
  if (territory.changes < minModuleCommits) {
    return unjudged("too few changes");
  }
  return unjudged("no partner to leak to");
};

/** How `territory` holds up, read from the territories the engine judged for the verdict. */
export const standingOf = (
  territory: Territory,
  { verdict, thresholds }: Pick<Report, "verdict" | "thresholds">,
): Standing => {
  const containment = territory.fit?.containment ?? null;
  if (containment === null || !verdict.judged.includes(territory.id)) {
    return whyUnjudged(territory, thresholds);
  }
  return verdict.leaking.includes(territory.id)
    ? { kind: "leaks", containment }
    : { kind: "holds", containment };
};
