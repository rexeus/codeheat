// Owns how often a module's interface changes against its implementation:
// the history-based signal for shallow or leaky modules.
import { isTestFile } from "../coupling/pair.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import type { ModuleRef } from "./detect.js";

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

type Tally = {
  interfaceCommits: number;
  implementationCommits: number;
  /** Implementation commits that also touched an entry point. */
  leakedCommits: number;
};

type Touched = {
  readonly entries: Set<string>;
  readonly implementations: Set<string>;
};

/** The modules whose entry points and whose implementation (other files, tests excluded) a commit touched. */
const touchedBy = (
  commit: Uint32Array,
  paths: ReadonlyArray<string>,
  refs: ReadonlyMap<string, ModuleRef>,
  entryFiles: ReadonlySet<string>,
): Touched => {
  const touched: Touched = { entries: new Set(), implementations: new Set() };
  for (const id of commit) {
    const file = paths[id] ?? "";
    const module = refs.get(file)?.path ?? ".";
    if (entryFiles.has(file)) {
      touched.entries.add(module);
    } else if (!isTestFile(file)) {
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

/**
 * Counts, per module, the counted commits that touched its entry points
 * (`interfaceCommits`) and those that touched any other non-test file
 * (`implementationCommits`), and the share of the latter that also touched an
 * entry point (`leakage`). Commits are the distinct ids of the files they
 * touched, ids being indexes into `paths`; `entryPoints` maps each module path
 * to its entry-point files.
 */
export const measureInterfaces = (
  commits: ReadonlyArray<Uint32Array>,
  paths: ReadonlyArray<string>,
  refs: ReadonlyMap<string, ModuleRef>,
  entryPoints: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyMap<string, InterfaceChurn> => {
  const entryFiles = new Set([...entryPoints.values()].flat());
  const tallies = new Map<string, Tally>(
    [...entryPoints.keys()].map((module) => [
      module,
      { interfaceCommits: 0, implementationCommits: 0, leakedCommits: 0 },
    ]),
  );
  for (const commit of commits) {
    const { entries, implementations } = touchedBy(
      commit,
      paths,
      refs,
      entryFiles,
    );
    for (const module of entries) {
      const tally = tallies.get(module);
      if (tally !== undefined) {
        tally.interfaceCommits += 1;
      }
    }
    for (const module of implementations) {
      const tally = tallies.get(module);
      if (tally !== undefined) {
        tally.implementationCommits += 1;
        tally.leakedCommits += Number(entries.has(module));
      }
    }
  }
  return new Map(
    [...tallies].map(([module, tally]) => [
      module,
      toChurn(entryPoints.get(module) ?? [], tally),
    ]),
  );
};

/**
 * The entry-point files of the modules whose interface leaks (see
 * `MIN_LEAKAGE`, `MIN_IMPLEMENTATION_COMMITS`), each with its module's
 * leakage. Test-only modules have no interface worth calling out.
 */
export const leakyEntryPoints = (
  modules: ReadonlyArray<Module>,
): ReadonlyMap<string, number> =>
  new Map(
    modules.flatMap(
      ({ entryPoints, implementationCommits, leakage, testOnly }) =>
        !testOnly &&
        leakage !== null &&
        leakage >= MIN_LEAKAGE &&
        implementationCommits >= MIN_IMPLEMENTATION_COMMITS
          ? entryPoints.map((file): [string, number] => [file, leakage])
          : [],
    ),
  );
