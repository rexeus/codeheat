// Owns finding the territory each territory's changes most often reach into.
import { Order } from "effect";

import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { ModuleCoChange } from "../distant/module-co-change.js";
import { roundReported } from "../model/precision.js";
import type { TerritoryFit } from "../model/territory-fit.js";

type Partner = NonNullable<TerritoryFit["partner"]>;

/** Whether `candidate` shares more changes than `known`, ties to the lower id. */
const beats = (candidate: Partner, known: Partner | undefined): boolean =>
  known === undefined ||
  candidate.sharedChanges > known.sharedChanges ||
  (candidate.sharedChanges === known.sharedChanges &&
    Order.String(candidate.territory, known.territory) < 0);

/**
 * For each ranked area of `coChange`, the other ranked area it shares the
 * most changes with, at least `MIN_SHARED_COMMITS`; an area with no such
 * partner is absent.
 */
export const strongestPartners = ({
  commits,
  shared,
}: ModuleCoChange): ReadonlyMap<string, Partner> => {
  const partners = new Map<string, Partner>();
  const offer = (from: string, to: string, sharedChanges: number): void => {
    const own = commits.get(from) ?? 0;
    const candidate = {
      territory: to,
      sharedChanges,
      share: roundReported(own === 0 ? 0 : sharedChanges / own),
    };
    if (beats(candidate, partners.get(from))) {
      partners.set(from, candidate);
    }
  };
  for (const [low, others] of shared) {
    for (const [high, sharedChanges] of others) {
      if (sharedChanges >= MIN_SHARED_COMMITS) {
        offer(low, high, sharedChanges);
        offer(high, low, sharedChanges);
      }
    }
  }
  return partners;
};
