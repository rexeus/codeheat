// Owns counting the coupled file pairs that cross a territory's boundary.
import { Order } from "effect";

import { isJudgeablePair } from "../distant/distant-couplings.js";
import type { Coupling } from "../report/report.js";

/** The pairs that leave one territory for another. */
export type Crossings = {
  readonly pairs: number;
  /** Pairs no import links. */
  readonly hidden: number;
};

/** The crossings of every area, and of every pair of areas, nested as `lower id -> higher id`. */
export type AreaCrossings = {
  readonly ofArea: ReadonlyMap<string, Crossings>;
  readonly ofPair: ReadonlyMap<string, ReadonlyMap<string, Crossings>>;
};

type Tally = { pairs: number; hidden: number };

const add = (tally: Tally | undefined, hidden: boolean): Tally => {
  const own = tally ?? { pairs: 0, hidden: 0 };
  own.pairs += 1;
  own.hidden += hidden ? 1 : 0;
  return own;
};

/**
 * The coupled pairs (see `isJudgeablePair`: no test code, no two contract
 * files) of which one file lies in one area and the other in a different one,
 * counted for each of the two areas and for the pair of areas; `areaOfFile`
 * maps a path to its area. Pairs with a file that has no area, or in an area
 * of `ignored`, count for none.
 */
export const crossingPairs = (
  couplings: ReadonlyArray<Coupling>,
  areaOfFile: ReadonlyMap<string, string>,
  ignored: ReadonlySet<string>,
): AreaCrossings => {
  const ofArea = new Map<string, Tally>();
  const ofPair = new Map<string, Map<string, Tally>>();
  for (const coupling of couplings) {
    const a = areaOfFile.get(coupling.a);
    const b = areaOfFile.get(coupling.b);
    if (
      a === undefined ||
      b === undefined ||
      a === b ||
      ignored.has(a) ||
      ignored.has(b) ||
      !isJudgeablePair(coupling)
    ) {
      continue;
    }
    const hidden = coupling.imports === "none";
    for (const area of [a, b]) {
      ofArea.set(area, add(ofArea.get(area), hidden));
    }
    const [low, high] = Order.String(a, b) <= 0 ? [a, b] : [b, a];
    const partners = ofPair.get(low) ?? new Map<string, Tally>();
    partners.set(high, add(partners.get(high), hidden));
    ofPair.set(low, partners);
  }
  return { ofArea, ofPair };
};

/** No crossing at all, for a report without a recommended detail. */
export const NO_CROSSINGS: AreaCrossings = {
  ofArea: new Map(),
  ofPair: new Map(),
};

/** The pairs between areas `a` and `b`, which both of them count among their own; none when no pair crosses between them. */
export const crossingsBetween = (
  { ofPair }: AreaCrossings,
  a: string,
  b: string,
): Crossings => {
  const [low, high] = Order.String(a, b) <= 0 ? [a, b] : [b, a];
  return ofPair.get(low)?.get(high) ?? { pairs: 0, hidden: 0 };
};
