// Owns the entry point of two territories whose boundaries leak into each
// other: one story told once, not once from each side.
import type { Clique } from "../model/clique.js";
import { crossingsBetween } from "../territory-fit/crossing-pairs.js";
import type { AreaCrossings } from "../territory-fit/crossing-pairs.js";
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

/** What a boundary between two territories counts once that each territory counts on its own. */
export type PairContext = {
  /** Path of each territory, by id. */
  readonly pathOf: ReadonlyMap<string, string>;
  /** The coupled file pairs between the territories at the recommended detail. */
  readonly crossings: AreaCrossings;
  /** The cliques among the territories at the recommended detail. */
  readonly cliques: ReadonlyArray<Clique>;
};

/** The changes of `territory` that touched no other territory: its `containment` over its `changes` (exact: the share is rounded to 4 decimals, far finer than one change). */
const localChanges = ({ fit, changes }: Judged): number =>
  Math.round((fit.containment ?? 0) * changes);

/**
 * The numbers of the two territories together, under the names of a single
 * boundary, each counting a change or a file pair once:
 * - `heatShare` adds (the territories do not overlap);
 * - `changes` counts the changes that touched either (the two territories'
 *   changes less those both touched, which `sharedChanges` counts);
 * - `containment` is the share of those changes that stayed inside one of the
 *   two, touching no territory outside the pair and not both: the changes
 *   that stayed inside either, over `changes`;
 * - `partnerShare` is the share of those changes that touched both;
 * - `chronicShare` is the share of the pair's production heat that lies in
 *   chronic hotspots, each territory's weighted by its `heatShare`;
 * - `fixShare` is each territory's share of fixes weighted by its changes (a
 *   change that touched both counts for each; the fixes among those are not
 *   known), or that of the one that has it;
 * - `distantPairs` and `hiddenPairs` count the file pairs that leave the pair
 *   for another territory (those of each territory that cross to a third) and
 *   the pairs between the two once;
 * - `cliques` counts the cliques that have either territory as a member.
 */
const togetherEvidence = (
  [a, b]: readonly [Judged, Judged],
  sharedChanges: number,
  { crossings, cliques }: Pick<PairContext, "crossings" | "cliques">,
): Readonly<Record<string, number>> => {
  const changes = a.changes + b.changes - sharedChanges;
  const between = crossingsBetween(crossings, a.id, b.id);
  const fixed = [a, b].flatMap(({ fit, changes: weight }) =>
    fit.fixDensity === null ? [] : ([[fit.fixDensity.share, weight]] as const),
  );
  return evidenceOf({
    heatShare: a.heatShare + b.heatShare,
    containment:
      changes === 0 ? 0 : (localChanges(a) + localChanges(b)) / changes,
    changes,
    sharedChanges,
    chronicShare: weightedMean([
      [a.fit.chronicShare, a.heatShare],
      [b.fit.chronicShare, b.heatShare],
    ]),
    fixShare: fixed.length === 0 ? undefined : weightedMean(fixed),
    distantPairs: a.fit.distantPairs + b.fit.distantPairs - between.pairs,
    hiddenPairs: a.fit.hiddenPairs + b.fit.hiddenPairs - between.hidden,
    cliques: cliques.filter(({ modules }) =>
      modules.some((id) => id === a.id || id === b.id),
    ).length,
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
  context: PairContext,
): Candidate => {
  const { pathOf } = context;
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
    evidence: togetherEvidence([a, b], first.partner.sharedChanges, context),
    verdict: boundaryPairVerdict(pathA, pathB, isEroding(a) || isEroding(b)),
    designMove: boundaryPairMove(pathA, pathB),
    parts: [findingOf(first.candidate), findingOf(second.candidate)],
  };
};
