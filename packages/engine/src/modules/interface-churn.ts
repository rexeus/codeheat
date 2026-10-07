// Owns how often a module's interface changes against its implementation:
// the history-based signal for shallow or leaky modules.
import { countedChanges } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { Module } from "../model/module.js";
import { roundReported } from "../model/precision.js";
import type { ModuleRef } from "./detect.js";
import { isTestPath } from "./test-path.js";

/** Smallest leakage at which a module's interface is called out. */
export const MIN_LEAKAGE = 0.5;
/** Fewest implementation commits a module needs before its leakage is called out. */
export const MIN_IMPLEMENTATION_COMMITS = 5;

export type InterfaceChurn = Pick<
  Module,
  "entryPoints" | "interfaceCommits" | "implementationCommits" | "leakage"
>;

/** A module without entry points or history. */
export const NO_INTERFACE: InterfaceChurn = {
  entryPoints: [],
  interfaceCommits: 0,
  implementationCommits: 0,
  leakage: null,
};

/** What `measureInterfaces` found. */
export type InterfaceMeasure = {
  /** Churn of every module that has an entry in the `entryPoints` given. */
  readonly byModule: ReadonlyMap<string, InterfaceChurn>;
  /** Entry points that changed in at least one commit that also changed their module's implementation. */
  readonly leakedEntryPoints: ReadonlySet<string>;
};

type Tally = {
  interfaceCommits: number;
  implementationCommits: number;
  /** Implementation commits that also touched an entry point. */
  leakedCommits: number;
};

type Touched = {
  /** The entry points a commit touched, per module. */
  readonly entries: Map<string, Array<string>>;
  /** The modules whose implementation (other files, test code excluded) it touched. */
  readonly implementations: Set<string>;
};

const touchedBy = (
  commit: Uint32Array,
  paths: ReadonlyArray<string>,
  refs: ReadonlyMap<string, ModuleRef>,
  entryFiles: ReadonlySet<string>,
): Touched => {
  const touched: Touched = { entries: new Map(), implementations: new Set() };
  for (const id of commit) {
    const file = paths[id] ?? "";
    const module = refs.get(file)?.path ?? ".";
    if (entryFiles.has(file)) {
      touched.entries.set(module, [
        ...(touched.entries.get(module) ?? []),
        file,
      ]);
    } else if (!isTestPath(file)) {
      touched.implementations.add(module);
    }
  }
  return touched;
};

const toChurn = (
  entryPoints: ReadonlyArray<string>,
  tally: Tally,
): InterfaceChurn => ({
  entryPoints,
  interfaceCommits: tally.interfaceCommits,
  implementationCommits: tally.implementationCommits,
  leakage:
    entryPoints.length === 0 || tally.implementationCommits === 0
      ? null
      : roundReported(tally.leakedCommits / tally.implementationCommits),
});

/** Credits one commit to the modules whose entry points or implementation it touched, and notes the entry points it leaked. */
const countCommit = (
  { entries, implementations }: Touched,
  tallies: ReadonlyMap<string, Tally>,
  leakedEntryPoints: Set<string>,
): void => {
  for (const module of entries.keys()) {
    const tally = tallies.get(module);
    if (tally !== undefined) {
      tally.interfaceCommits += 1;
    }
  }
  for (const module of implementations) {
    const tally = tallies.get(module);
    const leaked = entries.get(module) ?? [];
    if (tally !== undefined) {
      tally.implementationCommits += 1;
      tally.leakedCommits += Number(leaked.length > 0);
      for (const file of leaked) {
        leakedEntryPoints.add(file);
      }
    }
  }
};

/**
 * Counts, per module, the counted commits (see `countedChanges`)
 * that touched its entry points (`interfaceCommits`) and those that touched any
 * other file that is not test code (`implementationCommits`), and the share of
 * the latter that also touched an entry point (`leakage`). Each commit of
 * `history` lists the distinct ids of the files whose current file it touched,
 * ids being indexes into `history.paths`; `entryPoints` maps each module path to its entry-point files.
 */
export const measureInterfaces = (
  { changes, paths }: Pick<History, "changes" | "paths">,
  refs: ReadonlyMap<string, ModuleRef>,
  entryPoints: ReadonlyMap<string, ReadonlyArray<string>>,
): InterfaceMeasure => {
  const entryFiles = new Set([...entryPoints.values()].flat());
  const tallies = new Map<string, Tally>(
    [...entryPoints.keys()].map((module) => [
      module,
      { interfaceCommits: 0, implementationCommits: 0, leakedCommits: 0 },
    ]),
  );
  const leakedEntryPoints = new Set<string>();
  for (const change of countedChanges(changes)) {
    countCommit(
      touchedBy(change.files, paths, refs, entryFiles),
      tallies,
      leakedEntryPoints,
    );
  }
  return {
    byModule: new Map(
      [...tallies].map(([module, tally]) => [
        module,
        toChurn(entryPoints.get(module) ?? [], tally),
      ]),
    ),
    leakedEntryPoints,
  };
};

/**
 * Whether a module's interface leaks enough to call out: a leakage of at least
 * `MIN_LEAKAGE` over at least `MIN_IMPLEMENTATION_COMMITS` implementation
 * commits. A test-only module has no interface to judge.
 */
export const isLeakyInterface = (
  { leakage, implementationCommits }: InterfaceChurn,
  testOnly: boolean,
): boolean =>
  !testOnly &&
  leakage !== null &&
  leakage >= MIN_LEAKAGE &&
  implementationCommits >= MIN_IMPLEMENTATION_COMMITS;

/**
 * The entry points that deserve the leak reason, each with its module's
 * leakage: those of a leaky module (`Module.leakyInterface`) that changed in at
 * least one commit that also changed the module's implementation. An entry
 * point that never changes, such as a root stub re-exporting `src/index.ts`,
 * has nothing to be blamed for.
 */
export const leakingEntryPoints = (
  modules: ReadonlyArray<Module>,
  leakedEntryPoints: ReadonlySet<string>,
): ReadonlyMap<string, number> =>
  new Map(
    modules.flatMap(({ entryPoints, leakage, leakyInterface }) =>
      leakyInterface && leakage !== null
        ? entryPoints
            .filter((file) => leakedEntryPoints.has(file))
            .map((file): [string, number] => [file, leakage])
        : [],
    ),
  );
