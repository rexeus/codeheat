// Owns counting the coupled file pairs that cross a territory's boundary.
import { isJudgeablePair } from "../distant/distant-couplings.js";
import type { Coupling } from "../report/report.js";

/** The pairs that leave one territory for another. */
export type Crossings = {
  readonly pairs: number;
  /** Pairs no import links. */
  readonly hidden: number;
};

/**
 * For each area, the coupled pairs (see `isJudgeablePair`: no test code, no
 * two contract files) of which one file lies in it and the other in a
 * different one; `areaOfFile` maps a path to its area. Pairs with a file that
 * has no area, or in an area of `ignored`, count for none.
 */
export const crossingPairs = (
  couplings: ReadonlyArray<Coupling>,
  areaOfFile: ReadonlyMap<string, string>,
  ignored: ReadonlySet<string>,
): ReadonlyMap<string, Crossings> => {
  const crossings = new Map<string, { pairs: number; hidden: number }>();
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
    for (const area of [a, b]) {
      const tally = crossings.get(area) ?? { pairs: 0, hidden: 0 };
      tally.pairs += 1;
      tally.hidden += coupling.imports === "none" ? 1 : 0;
      crossings.set(area, tally);
    }
  }
  return crossings;
};
