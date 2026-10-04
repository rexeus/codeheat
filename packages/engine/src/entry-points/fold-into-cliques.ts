// Owns folding a boundary into the clique that explains it: territories that
// change as one unit leak into each other by definition, so a boundary entry
// about them says the same thing again.
import type { Entry } from "./candidate.js";

/** Whether `clique` ranks above `boundary`: a better score, since a boundary leads on a tie (see `byScore` in `rankEntryPoints`). */
const outranks = (clique: Entry, boundary: Entry): boolean =>
  clique.score > boundary.score;

/** The best clique that ranks above the boundary and has every territory of the boundary among its members. */
const cliqueOf = (
  boundary: Entry,
  cliques: ReadonlyArray<Entry>,
): Entry | undefined =>
  cliques.find(
    (clique) =>
      outranks(clique, boundary) &&
      boundary.territories.every((id) => clique.territories.includes(id)),
  );

/**
 * The entries with each `boundary` entry folded into a higher ranked `clique`
 * entry that has all of its territories as members: the boundary is no entry
 * of its own, and its findings (its own, then the findings it is made of and
 * those of the hotspots it took in) follow those of the clique. A boundary
 * entry whose primary finding is a hotspot is no boundary entry; a boundary
 * with a territory outside every higher ranked clique stays. The order of the
 * entries and every other field stay as they are.
 */
export const foldIntoCliques = (
  entries: ReadonlyArray<Entry>,
): ReadonlyArray<Entry> => {
  const cliques = entries
    .filter(({ kind }) => kind === "clique")
    .toSorted((a, b) => b.score - a.score);
  const folded = new Map<Entry, Array<Entry>>();
  for (const entry of entries.filter(({ kind }) => kind === "boundary")) {
    const clique = cliqueOf(entry, cliques);
    if (clique !== undefined) {
      folded.set(clique, [...(folded.get(clique) ?? []), entry]);
    }
  }
  const absorbed = new Set([...folded.values()].flat());
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
