// Owns the ranked list of entry points: every kind's candidates, merged into
// the at most ten places to start.
import { Order } from "effect";

import type { EntryPoint } from "../report/entry-point.js";
import { roundReported } from "../report/precision.js";
import type { Entry } from "./candidate.js";
import { entriesOf } from "./entries-of.js";
import { gatherCandidates } from "./gather-candidates.js";
import type { EntryPointInput } from "./gather-candidates.js";
import type { EntryLimits } from "./limits.js";

const byScore = (a: Entry, b: Entry): number =>
  b.score - a.score ||
  Order.String(a.kind, b.kind) ||
  Order.String(
    [...a.territories, ...a.files].join("\n"),
    [...b.territories, ...b.files].join("\n"),
  );

/**
 * Merges the entries of every kind into the list: each kind keeps its
 * `limits.maxEntriesPerKind` best, the best of every kind is listed whatever
 * its score, and the other places are filled by score, up to
 * `limits.maxEntries`, those that score `limits.minEntryScore` or more.
 * Ranked by score, then kind, then what the entry concerns.
 */
const pick = (
  entries: ReadonlyArray<Entry>,
  limits: EntryLimits,
): ReadonlyArray<Entry> => {
  const perKind = new Map<string, Array<Entry>>();
  for (const entry of entries.toSorted(byScore)) {
    const own = perKind.get(entry.kind) ?? [];
    if (own.length < limits.maxEntriesPerKind) {
      own.push(entry);
      perKind.set(entry.kind, own);
    }
  }
  const best = [...perKind.values()].flatMap((own) => own.slice(0, 1));
  const rest = [...perKind.values()]
    .flatMap((own) => own.slice(1))
    .filter(({ score }) => score >= limits.minEntryScore);
  return [
    ...best,
    ...rest.toSorted(byScore).slice(0, limits.maxEntries - best.length),
  ]
    .slice(0, limits.maxEntries)
    .toSorted(byScore);
};

/** The files an entry names, in any of its findings. */
const namedBy = (entry: Entry): ReadonlyArray<string> =>
  entry.findings.flatMap(({ files }) => files);

/** The kinds about files, which another entry may already name. */
const isAboutFiles = ({ kind }: Entry): boolean =>
  kind === "hub" || kind === "coupling" || kind === "copies";

/**
 * Picks the list (see `pick`) without an entry about files that a single
 * higher ranked entry already names all of: such an entry says nothing new,
 * and its place goes to the next one. Files named by two different entries
 * are new information together.
 */
const pickWithoutRepeats = (
  entries: ReadonlyArray<Entry>,
  limits: EntryLimits,
): ReadonlyArray<Entry> => {
  const picked = pick(entries, limits);
  const repeat = picked.find(
    (entry, index) =>
      isAboutFiles(entry) &&
      entry.files.length > 0 &&
      picked
        .slice(0, index)
        .some((higher) =>
          entry.files.every((file) => namedBy(higher).includes(file)),
        ),
  );
  return repeat === undefined
    ? picked
    : pickWithoutRepeats(
        entries.filter((entry) => entry !== repeat),
        limits,
      );
};

/** The entries with their score rounded as the report rounds it, those with nothing at stake left out. */
const scored = (entries: ReadonlyArray<Entry>): ReadonlyArray<Entry> =>
  entries
    .map((entry) =>
      Object.assign({}, entry, { score: roundReported(entry.score) }),
    )
    .filter(({ score }) => score > 0);

/**
 * Ranks the places to start (see `EntryPoint`) among the candidates of every
 * kind, a territory that is both a boundary and a hotspot counting once (see
 * `entriesOf`); see `gatherCandidates` and the modules of the kinds for the
 * rules. Every entry scores at least `limits.minEntryScore`, except the best
 * entry of each kind, which the list always holds. An entry about files that
 * a higher ranked entry names all of is left out. Empty when nothing
 * qualifies.
 */
export const rankEntryPoints = (
  input: EntryPointInput,
): ReadonlyArray<EntryPoint> =>
  pickWithoutRepeats(
    scored(entriesOf(gatherCandidates(input))),
    input.limits,
  ).map((entry, index) => Object.assign({ rank: index + 1 }, entry));
