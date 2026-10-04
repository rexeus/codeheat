// Owns the answer to "what changes together?": the pairs of territories that
// keep changing in the same changes (`Report.territoryCoupling`).
import type { Report } from "@codeheat/engine";

import { distinctNameParts } from "../territories/distinct-names.js";
import type {
  NameParts,
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";

/** One side of a pair. */
export type PairSide = {
  readonly id: string;
  readonly name: NameParts;
  /** The share of its changes that stay inside it; `null` when it has none counted. */
  readonly containment: number | null;
};

export type TerritoryPair = {
  /** The hotter territory of the two. */
  readonly a: PairSide;
  readonly b: PairSide;
  /** Counted changes that touched both. */
  readonly sharedChanges: number;
  /** Coupled file pairs between the two. */
  readonly filePairs: number;
  /** Of those, the pairs no import links: hidden coupling. */
  readonly hiddenPairs: number;
};

export type CoChange =
  | { readonly kind: "none"; readonly note: string }
  | {
      readonly kind: "some";
      /** Strongest first: most shared changes, then most hidden pairs. */
      readonly pairs: readonly [TerritoryPair, ...TerritoryPair[]];
      /** File pairs with no import between them, summed across all the pairs. */
      readonly hiddenPairs: number;
    };

const NO_TERRITORIES =
  "This report has no territories; analyze again with a current codeheat.";

const byStrength = (one: TerritoryPair, other: TerritoryPair): number =>
  other.sharedChanges - one.sharedChanges ||
  other.hiddenPairs - one.hiddenPairs ||
  `${one.a.name.base} ${one.b.name.base}`.localeCompare(
    `${other.a.name.base} ${other.b.name.base}`,
  );

/**
 * The pairs of territories the report found changing together, strongest
 * first, each named so that it tells itself apart from the territories beside
 * it. A pair whose territory the report does not know is left out. Says so
 * plainly when the report has no territories or no pair shares enough changes
 * (`thresholds.minSharedCommits`).
 */
export const coChangeOf = (report: Report, index: TerritoryIndex): CoChange => {
  if (index.recommended.length === 0) {
    return { kind: "none", note: NO_TERRITORIES };
  }
  const nameOf = distinctNameParts(index.recommended);
  const sideOf = (territory: Territory): PairSide => ({
    id: territory.id,
    name: nameOf(territory),
    containment: territory.fit?.containment ?? null,
  });
  const pairs = report.territoryCoupling
    .flatMap((pair) => {
      const ends = [index.byId.get(pair.a), index.byId.get(pair.b)]
        .filter((end) => end !== undefined)
        .toSorted((one, other) => other.heatShare - one.heatShare);
      const [a, b] = ends;
      return a === undefined || b === undefined
        ? []
        : [
            {
              a: sideOf(a),
              b: sideOf(b),
              sharedChanges: pair.sharedChanges,
              filePairs: pair.distantPairs,
              hiddenPairs: pair.hiddenPairs,
            },
          ];
    })
    .toSorted(byStrength);
  const [strongest, ...weaker] = pairs;
  if (strongest === undefined) {
    return {
      kind: "none",
      note: `No two territories changed together in ${report.thresholds.minSharedCommits} or more changes.`,
    };
  }
  return {
    kind: "some",
    pairs: [strongest, ...weaker],
    hiddenPairs: pairs.reduce((sum, { hiddenPairs }) => sum + hiddenPairs, 0),
  };
};
