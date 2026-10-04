// Owns folding a boundary and the clique that explains it into one entry:
// territories that change as one unit leak into each other by definition, so
// a boundary entry and a clique entry about the same territories tell one
// story, and the one that ranks higher tells it, except that a boundary never
// hides a larger story: it takes in a clique of at most one territory more.
import type { Entry } from "./candidate.js";

/** Whether `boundary` concerns only territories that `clique` has as members. */
const isWithin = (boundary: Entry, clique: Entry): boolean =>
  boundary.territories.every((id) => clique.territories.includes(id));

/** The most members a clique may have for a boundary between two territories to take it in: the two and one more. */
const MAX_CLIQUE_FOR_PAIR = 3;

/** Whether a boundary may take in `clique`: only a pair entry takes in only a clique that has at most one territory beyond the pair; a larger clique is the bigger story and stays. */
const isSmallEnough = (boundary: Entry, clique: Entry): boolean =>
  boundary.territories.length === 2 &&
  clique.territories.length <= MAX_CLIQUE_FOR_PAIR;

/**
 * Whether `higher` ranks above `lower`: a better score, a boundary on a tie,
 * as `byScore` in `rankEntryPoints` orders them.
 */
const outranks = (higher: Entry, lower: Entry): boolean =>
  higher.score > lower.score ||
  (higher.score === lower.score &&
    higher.kind === "boundary" &&
    lower.kind === "clique");

/** The entries of the other kind that `entry` explains: all territories of the boundary lie among the members of the clique, and they rank below it. */
const explainedBy = (
  entry: Entry,
  others: ReadonlyArray<Entry>,
): ReadonlyArray<Entry> =>
  others.filter(
    (other) =>
      other.kind !== entry.kind &&
      outranks(entry, other) &&
      (entry.kind === "boundary"
        ? isWithin(entry, other) && isSmallEnough(entry, other)
        : isWithin(other, entry)),
  );

/**
 * The entries with each `boundary` entry and each `clique` entry that explain
 * one another folded into the higher ranked of the two: the boundary has all
 * of its territories among the members of the clique. A clique takes in any
 * boundary it ranks above; a boundary takes in a clique it ranks above only
 * when it is a pair entry and the clique has at most three members. The lower ranked is no
 * entry of its own, and its findings (its own, then the findings it is made
 * of and those of the hotspots it took in) follow those of the higher ranked.
 * The higher ranked keeps its `kind`, `territories`, and everything else. An
 * entry that is itself folded takes in nothing (the highest ranked goes
 * first), a boundary entry whose primary finding is a hotspot is no boundary
 * entry, and every other kind stays. The order of the entries stays.
 */
export const foldBoundariesAndCliques = (
  entries: ReadonlyArray<Entry>,
): ReadonlyArray<Entry> => {
  const folded = new Map<Entry, ReadonlyArray<Entry>>();
  const absorbed = new Set<Entry>();
  const explainers = entries
    .filter(({ kind }) => kind === "boundary" || kind === "clique")
    .toSorted((a, b) => b.score - a.score);
  for (const entry of explainers) {
    if (absorbed.has(entry)) {
      continue;
    }
    const taken = explainedBy(
      entry,
      explainers.filter((other) => !absorbed.has(other)),
    );
    folded.set(entry, taken);
    for (const other of taken) {
      absorbed.add(other);
    }
  }
  return entries
    .filter((entry) => !absorbed.has(entry))
    .map((entry) =>
      Object.assign({}, entry, {
        findings: [
          ...entry.findings,
          ...(folded.get(entry) ?? []).flatMap(({ findings }) => findings),
        ],
      }),
    );
};
