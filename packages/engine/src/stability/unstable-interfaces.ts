// Owns finding unstable interfaces: files that many others depend on and that
// change more often than those dependents do.
import { Order } from "effect";

import { countedChanges } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { ModuleRef } from "../modules/detect.js";
import { isTestPath } from "../modules/test-path.js";
import type { UnstableInterface } from "../report/unstable-interface.js";

/** Fewest dependents (see `UnstableInterface.fanIn`) that make a file an interface many rely on. */
export const MIN_FAN_IN = 5;

/** Fewest logical changes a file needs before its changes count as frequent. */
export const MIN_INTERFACE_CHANGES = 5;

/** The report keeps this many unstable interfaces, the ones that changed most dependents first. */
const MAX_UNSTABLE_INTERFACES = 50;
const SHOWN_DEPENDENTS = 5;

type Candidate = {
  readonly path: string;
  readonly dependents: ReadonlySet<string>;
  readonly changes: number;
  readonly medianDependentChanges: number;
  /** Counted changes shared with each dependent. */
  readonly together: Map<string, number>;
};

const median = (values: ReadonlyArray<number>): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : Math.floor(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
};

/** Files with enough dependents and logical changes that change more often than the typical dependent. */
const candidatesOf = (
  dependents: ReadonlyMap<string, ReadonlySet<string>>,
  changesOf: (path: string) => number,
): ReadonlyArray<Candidate> =>
  [...dependents].flatMap(([path, own]) => {
    const changes = changesOf(path);
    if (
      own.size < MIN_FAN_IN ||
      changes < MIN_INTERFACE_CHANGES ||
      isTestPath(path)
    ) {
      return [];
    }
    const medianDependentChanges = median(
      [...own].map((dependent) => changesOf(dependent)),
    );
    return changes > medianDependentChanges
      ? [
          {
            path,
            dependents: own,
            changes,
            medianDependentChanges,
            together: new Map<string, number>(),
          },
        ]
      : [];
  });

/** Credits `candidate` with one more shared change for each of its dependents among the files of one change. */
const creditDependents = (
  candidate: Candidate,
  commit: Uint32Array,
  paths: ReadonlyArray<string>,
): void => {
  for (const other of commit) {
    const path = paths[other] ?? "";
    if (candidate.dependents.has(path)) {
      candidate.together.set(path, (candidate.together.get(path) ?? 0) + 1);
    }
  }
};

/** Counts, per candidate, the counted changes it shares with each of its dependents. */
const countTogether = (
  candidates: ReadonlyArray<Candidate>,
  history: Pick<History, "changes" | "paths">,
): void => {
  const idOf = new Map(history.paths.map((path, id) => [path, id]));
  const byId = new Map(
    candidates.flatMap((candidate) => {
      const id = idOf.get(candidate.path);
      return id === undefined ? [] : [[id, candidate] as const];
    }),
  );
  for (const change of countedChanges(history.changes)) {
    for (const id of change.files) {
      const candidate = byId.get(id);
      if (candidate !== undefined) {
        creditDependents(candidate, change.files, history.paths);
      }
    }
  }
};

const reasonFor = ({
  dependents,
  changes,
  medianDependentChanges,
  together,
}: Candidate): string =>
  `${dependents.size} files depend on it and it changed in ${changes} logical changes, against a median of ${medianDependentChanges} for them; ${together.size} of them changed together with it`;

const byRipple = (a: UnstableInterface, b: UnstableInterface): number =>
  b.changedDependents - a.changedDependents ||
  b.changes - a.changes ||
  b.fanIn - a.fanIn ||
  Order.String(a.path, b.path);

/**
 * The unstable interfaces among the files that others depend on:
 * `dependents` maps a file to the files that depend on it (see
 * `dependentsByFile`), test code left out by the caller. A file is one when at
 * least `MIN_FAN_IN` files depend on it, it has at least
 * `MIN_INTERFACE_CHANGES` logical changes (`FileStats.changes`: the churn of an
 * interface is how often it was changed as a whole, not how many commits it
 * took), and more changes than the median of its dependents. The
 * `MAX_UNSTABLE_INTERFACES` that changed together with the most dependents come
 * first, then more changes, higher fan-in, and path.
 */
export const unstableInterfaces = (
  dependents: ReadonlyMap<string, ReadonlySet<string>>,
  history: Pick<History, "changes" | "paths" | "files">,
  modules: ReadonlyMap<string, ModuleRef>,
): ReadonlyArray<UnstableInterface> => {
  const candidates = candidatesOf(
    dependents,
    (path) => history.files.get(path)?.changes ?? 0,
  );
  countTogether(candidates, history);
  return candidates
    .map((candidate): UnstableInterface => ({
      path: candidate.path,
      module: modules.get(candidate.path)?.path ?? ".",
      fanIn: candidate.dependents.size,
      changes: candidate.changes,
      medianDependentChanges: candidate.medianDependentChanges,
      changedDependents: candidate.together.size,
      dependents: [...candidate.together]
        .map(([path, sharedCommits]) => ({ path, sharedCommits }))
        .toSorted(
          (a, b) =>
            b.sharedCommits - a.sharedCommits || Order.String(a.path, b.path),
        )
        .slice(0, SHOWN_DEPENDENTS),
      reason: reasonFor(candidate),
    }))
    .toSorted(byRipple)
    .slice(0, MAX_UNSTABLE_INTERFACES);
};
