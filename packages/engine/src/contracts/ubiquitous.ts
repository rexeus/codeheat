// Owns the contract files that change in too many commits to say anything: a
// central schema or API description edited in every pull request would couple
// to everything and drown out the real pairs, so such files are set aside.
import { Order } from "effect";

import { countedChanges } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { UbiquitousFile } from "../model/contract-file.js";
import { roundReported } from "../model/precision.js";

/** A contract file that changes in more than this share of the counted commits is ubiquitous. */
export const UBIQUITOUS_SHARE = 0.3;
/** Fewest counted commits a file needs to be ubiquitous, so a short history cannot make one. */
export const UBIQUITOUS_MIN_COMMITS = 10;

/**
 * The contract files among `contracts` that changed in more than
 * `UBIQUITOUS_SHARE` of the counted commits of `history` (see
 * `countedChanges`), and in at least `UBIQUITOUS_MIN_COMMITS` of them, most
 * changed first, ties by path.
 */
export const findUbiquitous = (
  history: Pick<History, "changes" | "paths">,
  contracts: ReadonlySet<string>,
): ReadonlyArray<UbiquitousFile> => {
  const counted = countedChanges(history.changes);
  const commitsOf = new Map<string, number>();
  for (const commit of counted) {
    for (const id of commit.files) {
      const path = history.paths[id] ?? "";
      if (contracts.has(path)) {
        commitsOf.set(path, (commitsOf.get(path) ?? 0) + 1);
      }
    }
  }
  return [...commitsOf]
    .filter(
      ([, commits]) =>
        commits >= UBIQUITOUS_MIN_COMMITS &&
        commits > UBIQUITOUS_SHARE * counted.length,
    )
    .map(([path, commits]) => ({
      path,
      commits,
      share: roundReported(commits / counted.length),
    }))
    .toSorted((a, b) => b.commits - a.commits || Order.String(a.path, b.path));
};
