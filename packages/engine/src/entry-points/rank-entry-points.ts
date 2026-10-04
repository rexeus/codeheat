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
 * `limits.maxEntries`. Ranked by score, then kind, then what the entry
 * concerns. Every entry has passed `limits.minEntryScore` already, so the best
 * of a kind that scores less is not listed at all.
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
  const rest = [...perKind.values()].flatMap((own) => own.slice(1));
  return [
    ...best,
    ...rest.toSorted(byScore).slice(0, limits.maxEntries - best.length),
  ]
    .slice(0, limits.maxEntries)
    .toSorted(byScore);
};

/** The entries with their score rounded as the report rounds it, those below `limits.minEntryScore` left out. */
const scored = (
  entries: ReadonlyArray<Entry>,
  limits: EntryLimits,
): ReadonlyArray<Entry> =>
  entries
    .map((entry) =>
      Object.assign({}, entry, { score: roundReported(entry.score) }),
    )
    .filter(({ score }) => score > 0 && score >= limits.minEntryScore);

/**
 * Ranks the places to start (see `EntryPoint`) among the candidates of every
 * kind, a territory that is both a boundary and a hotspot counting once (see
 * `entriesOf`), those scoring less than `limits.minEntryScore` left out; see
 * `gatherCandidates` and the modules of the kinds for the rules. Empty when
 * nothing qualifies.
 */
export const rankEntryPoints = (
  input: EntryPointInput,
): ReadonlyArray<EntryPoint> =>
  pick(
    scored(entriesOf(gatherCandidates(input)), input.limits),
    input.limits,
  ).map((entry, index) => Object.assign({ rank: index + 1 }, entry));
