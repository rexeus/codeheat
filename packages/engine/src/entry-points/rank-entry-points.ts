// Owns the ranked list of entry points: every kind's candidates, merged into
// the at most ten places to start.
import { Order } from "effect";

import type { Clique } from "../report/clique.js";
import type { CopyFamily } from "../report/copy-family.js";
import type { EntryPoint } from "../report/entry-point.js";
import { roundReported } from "../report/precision.js";
import type { FileStats } from "../report/report.js";
import type { Territories } from "../report/territory.js";
import type { UnstableInterface } from "../report/unstable-interface.js";
import { chainsOf } from "./ancestry.js";
import { boundaryEntries } from "./boundary.js";
import type { Candidate } from "./candidate.js";
import { cliqueEntries } from "./clique.js";
import { copiesEntries } from "./copies.js";
import { hotspotEntries } from "./hotspot.js";
import { hubEntries } from "./hub.js";
import { judgedTerritories } from "./judged-territories.js";

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

/** What the entry points are read from. */
export type EntryPointInput = {
  /** The territories with their fit; the recommended detail is the one judged. */
  readonly territories: Territories;
  readonly files: ReadonlyArray<FileStats>;
  /** The cliques among the territories at the recommended detail. */
  readonly cliques: ReadonlyArray<Clique>;
  readonly copyFamilies: ReadonlyArray<CopyFamily>;
  readonly unstableInterfaces: ReadonlyArray<UnstableInterface>;
  /** The counted changes of the window (`Report.window.couplingCommits`). */
  readonly changes: number;
  /** Fewest counted changes at which a territory is judged (`Thresholds.minModuleCommits`). */
  readonly minChanges: number;
};

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
 * Ranks the places to start (see `EntryPoint`): territories whose boundary
 * does not hold, territories whose heat is chronic, cliques of territories,
 * copy families, and unstable interfaces. Each kind has its own rule and
 * score; see the modules of the kinds. Empty when nothing qualifies.
 */
export const rankEntryPoints = (
  input: EntryPointInput,
): ReadonlyArray<EntryPoint> => {
  const { territories, files } = input;
  const judged = judgedTerritories(territories, input.minChanges);
  const byId = new Map(territories.nodes.map((node) => [node.id, node]));
  const pathOf = new Map(territories.nodes.map(({ id, path }) => [id, path]));
  const territoryOf = new Map(
    files.map(({ path, territory }) => [path, territory]),
  );
  const picked = pick([
    ...boundaryEntries(judged, pathOf),
    ...hotspotEntries(judged, files, chainsOf(territories.nodes)),
    ...cliqueEntries(input.cliques, byId),
    ...copiesEntries(input.copyFamilies, territoryOf, input.changes),
    ...hubEntries(input.unstableInterfaces, territoryOf, input.changes),
  ]);
  const ranked: Array<EntryPoint> = [];
  for (const candidate of picked) {
    const score = roundReported(candidate.score);
    if (score > 0) {
      ranked.push(
        Object.assign({ rank: ranked.length + 1 }, candidate, { score }),
      );
    }
  }
  return ranked;
};
