// Owns the entry point of two territories whose boundaries leak into each
// other: one story told once, not once from each side.
import { evidenceOf, findingOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import type { Judged } from "./judged-territories.js";
import { boundaryPairMove, boundaryPairVerdict } from "./moves.js";

type Partner = NonNullable<Judged["fit"]["partner"]>;

/** A territory whose boundary does not hold, with the territory it leaks into and the entry it is by itself. */
export type Leak = {
  readonly territory: Judged;
  readonly partner: Partner;
  readonly candidate: Candidate;
};

/** The weighted mean of `[value, weight]` pairs; 0 without weight. */
const weightedMean = (
  items: ReadonlyArray<readonly [value: number, weight: number]>,
): number => {
  const weight = items.reduce((sum, [, each]) => sum + each, 0);
  return weight === 0
    ? 0
    : items.reduce((sum, [value, each]) => sum + value * each, 0) / weight;
};

/**
 * The numbers of the two territories together, under the names of a single
 * boundary: the heat shares add; `changes` counts the changes that touched
 * either (the two territories' changes less those both touched, which
 * `sharedChanges` counts); `containment` and `fixShare` are the means of the
 * two weighted by changes and `chronicShare` weighted by code heat;
 * `partnerShare` is the share of those changes that touched both;
 * `distantPairs` and `hiddenPairs` add, so a file pair between the two counts
 * once for each; `cliques` is the larger of the two.
 */
const togetherEvidence = (
  [a, b]: readonly [Judged, Judged],
  sharedChanges: number,
): Readonly<Record<string, number>> => {
  const changes = a.changes + b.changes - sharedChanges;
  const fixed = [a, b].flatMap(({ fit, changes: weight }) =>
    fit.fixDensity === null ? [] : ([[fit.fixDensity.share, weight]] as const),
  );
  return evidenceOf({
    codeHeatShare: a.codeHeatShare + b.codeHeatShare,
    heatShare: a.heatShare + b.heatShare,
    containment: weightedMean([
      [a.fit.containment ?? 1, a.changes],
      [b.fit.containment ?? 1, b.changes],
    ]),
    changes,
    sharedChanges,
    chronicShare: weightedMean([
      [a.fit.chronicShare, a.codeHeatShare],
      [b.fit.chronicShare, b.codeHeatShare],
    ]),
    fixShare: fixed.length === 0 ? undefined : weightedMean(fixed),
    distantPairs: a.fit.distantPairs + b.fit.distantPairs,
    hiddenPairs: a.fit.hiddenPairs + b.fit.hiddenPairs,
    cliques: Math.max(a.fit.cliques, b.fit.cliques),
    partnerShare: changes === 0 ? 0 : sharedChanges / changes,
  });
};

const isEroding = ({ fit }: Judged): boolean =>
  fit.erosion?.verdict === "eroding";

/**
 * The boundary between two territories that are each other's `fit.partner`:
 * one entry about both, scored as the sum of the two boundaries it replaces,
 * which follow as its `parts`, the stronger first. Its territories are the
 * stronger first too. The evidence is that of both together (see
 * `togetherEvidence`).
 */
export const boundaryBetween = (
  x: Leak,
  y: Leak,
  pathOf: ReadonlyMap<string, string>,
): Candidate => {
  const [first, second] =
    y.candidate.score > x.candidate.score ? [y, x] : [x, y];
  const [a, b] = [first.territory, second.territory] as const;
  const pathA = pathOf.get(a.id) ?? a.id;
  const pathB = pathOf.get(b.id) ?? b.id;
  return {
    kind: "boundary",
    score: first.candidate.score + second.candidate.score,
    territories: [a.id, b.id],
    files: [],
    evidence: togetherEvidence([a, b], first.partner.sharedChanges),
    verdict: boundaryPairVerdict(pathA, pathB, isEroding(a) || isEroding(b)),
    designMove: boundaryPairMove(pathA, pathB),
    parts: [findingOf(first.candidate), findingOf(second.candidate)],
  };
};
