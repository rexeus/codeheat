// Owns the ranked list of entry points: every kind's candidates, merged into
// the at most ten places to start.
import { Order } from "effect";

import type { EntryPoint } from "../report/entry-point.js";
import { roundReported } from "../report/precision.js";
import type { Candidate } from "./candidate.js";
import { gatherCandidates } from "./gather-candidates.js";
import type { EntryPointInput } from "./gather-candidates.js";

/** The list has at most this many entry points. */
const MAX_ENTRY_POINTS = 10;

/** No kind has more than this many entry points. */
const MAX_PER_KIND = 4;

const byScore = (a: Candidate, b: Candidate): number =>
  b.score - a.score ||
  Order.String(a.kind, b.kind) ||
  Order.String(
    [...a.territories, ...a.files].join("\n"),
    [...b.territories, ...b.files].join("\n"),
  );

/**
 * Merges the candidates of every kind into the list: each kind keeps its four
 * best, the best of every kind is listed whatever its score, and the other
 * places are filled by score, up to ten. Ranked by score, then kind, then
 * what the entry concerns.
 */
const pick = (
  candidates: ReadonlyArray<Candidate>,
): ReadonlyArray<Candidate> => {
  const perKind = new Map<string, Array<Candidate>>();
  for (const candidate of candidates.toSorted(byScore)) {
    const own = perKind.get(candidate.kind) ?? [];
    if (own.length < MAX_PER_KIND) {
      own.push(candidate);
      perKind.set(candidate.kind, own);
    }
  }
  const best = [...perKind.values()].flatMap((own) => own.slice(0, 1));
  const rest = [...perKind.values()].flatMap((own) => own.slice(1));
  return [
    ...best,
    ...rest.toSorted(byScore).slice(0, MAX_ENTRY_POINTS - best.length),
  ]
    .slice(0, MAX_ENTRY_POINTS)
    .toSorted(byScore);
};

/**
 * Ranks the places to start (see `EntryPoint`) among the candidates of every
 * kind; see `gatherCandidates` and the modules of the kinds for the rules.
 * Empty when nothing qualifies.
 */
export const rankEntryPoints = (
  input: EntryPointInput,
): ReadonlyArray<EntryPoint> => {
  const ranked: Array<EntryPoint> = [];
  for (const candidate of pick(gatherCandidates(input))) {
    const score = roundReported(candidate.score);
    if (score > 0) {
      ranked.push(
        Object.assign({ rank: ranked.length + 1 }, candidate, { score }),
      );
    }
  }
  return ranked;
};
