// Owns which territories a territory changes with at one detail, read from the
// coupled file pairs that cross its edge.

import { territoryName } from "../territories/territory-index.js";
import type { CardSource } from "./card-model.js";
import type { LevelIndex } from "./level-index.js";

/** Another territory whose files keep changing in the same changes as this one's. */
export type CouplingPartner = {
  readonly name: string;
  /** Coupled pairs of files with one file in each territory. */
  readonly pairs: number;
  /** Of those, the pairs no import links. */
  readonly hiddenPairs: number;
  /** The pair that changed together most often. */
  readonly strongest: {
    readonly a: string;
    readonly b: string;
    readonly sharedChanges: number;
  };
};

/** How many partners the expanded card lists. */
const MAX_PARTNERS = 4;

type Pair = CardSource["couplings"][number];

type Tally = {
  pairs: number;
  hiddenPairs: number;
  strongest: CouplingPartner["strongest"];
};

/** The territory on the other side of `pair` when exactly one file is in the territory `id`; `undefined` otherwise. */
const otherSideOf = (
  pair: Pair,
  id: string,
  level: LevelIndex,
  source: CardSource,
): string | undefined => {
  const one = level.ownerOf(source.territoryOfFile.get(pair.a) ?? "");
  const other = level.ownerOf(source.territoryOfFile.get(pair.b) ?? "");
  if (one === id && other !== id) {
    return other;
  }
  return other === id && one !== id ? one : undefined;
};

const addPair = (
  tallies: Map<string, Tally>,
  partner: string,
  pair: Pair,
): void => {
  const tally = tallies.get(partner) ?? {
    pairs: 0,
    hiddenPairs: 0,
    strongest: { a: pair.a, b: pair.b, sharedChanges: 0 },
  };
  tally.pairs += 1;
  tally.hiddenPairs += pair.imports === "none" ? 1 : 0;
  if (pair.sharedCommits > tally.strongest.sharedChanges) {
    tally.strongest = {
      a: pair.a,
      b: pair.b,
      sharedChanges: pair.sharedCommits,
    };
  }
  tallies.set(partner, tally);
};

/**
 * The territories that share coupled file pairs with the territory `id`,
 * most pairs first, ties by the strongest pair. Pairs of a file and its test,
 * pairs with a file the report does not list, and pairs inside the territory
 * are not counted.
 */
export const couplingPartnersOf = (
  id: string,
  level: LevelIndex,
  source: CardSource,
): CouplingPartner[] => {
  const tallies = new Map<string, Tally>();
  for (const pair of source.couplings) {
    const partner = pair.testPair
      ? undefined
      : otherSideOf(pair, id, level, source);
    if (partner !== undefined) {
      addPair(tallies, partner, pair);
    }
  }
  return [...tallies]
    .toSorted(
      ([, left], [, right]) =>
        right.pairs - left.pairs ||
        right.strongest.sharedChanges - left.strongest.sharedChanges,
    )
    .slice(0, MAX_PARTNERS)
    .flatMap(([partner, tally]) => {
      const territory = source.territories.byId.get(partner);
      return territory === undefined
        ? []
        : [{ name: territoryName(territory), ...tally }];
    });
};
