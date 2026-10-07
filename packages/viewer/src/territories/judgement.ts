import type { Analysis } from "@codeheat/engine";

import type { Territory } from "./territory-index.js";

/**
 * How a territory holds up: it `leaks` or `holds` as the engine judged it for
 * the verdict (`Analysis.verdict`), or it is `unjudged`, with the `reason` in a
 * few plain words.
 */
export type Standing =
  | { readonly kind: "leaks"; readonly containment: number }
  | { readonly kind: "holds"; readonly containment: number }
  | { readonly kind: "unjudged"; readonly reason: string };

const unjudged = (reason: string): Standing => ({ kind: "unjudged", reason });

/**
 * Why the engine did not judge `territory`. Test code and leftover files are
 * not judged. A territory with no counted change has no heat either (heat
 * rests on the counted changes); one with fewer than `minModuleCommits`
 * counted changes has too few for its share to mean anything. One without a
 * partner keeps little inside but shares changes with no other territory,
 * which says nothing about where it leaks. A report from before the verdict
 * judged nothing, so any other territory is only not judged.
 */
const whyUnjudged = (
  territory: Territory,
  { minModuleCommits }: Analysis["thresholds"],
): Standing => {
  if (territory.kind === "tests") {
    return unjudged("test code");
  }
  if (territory.kind === "other") {
    return unjudged("leftover files");
  }
  if ((territory.fit?.containment ?? null) === null) {
    return unjudged("no counted changes");
  }
  if (territory.changes < minModuleCommits) {
    return unjudged("too few changes");
  }
  return (territory.fit?.partner ?? null) === null
    ? unjudged("no partner to leak to")
    : unjudged("not judged");
};

/** How `territory` holds up, read from the territories the engine judged for the verdict. */
export const standingOf = (
  territory: Territory,
  { verdict, thresholds }: Pick<Analysis, "verdict" | "thresholds">,
): Standing => {
  const containment = territory.fit?.containment ?? null;
  if (containment === null || !verdict.judged.includes(territory.id)) {
    return whyUnjudged(territory, thresholds);
  }
  return verdict.leaking.includes(territory.id)
    ? { kind: "leaks", containment }
    : { kind: "holds", containment };
};
