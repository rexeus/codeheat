// Owns how self-contained each module's changes are: counted commits that
// stay inside it, and which other modules the rest pull in. It assembles the
// module records, adding the interface churn measured next to it.
import { Order } from "effect";

import type { History } from "../history/history.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import type { ModuleRef } from "./detect.js";
import { isLeakyInterface, NO_INTERFACE } from "./interface-churn.js";
import type { InterfaceChurn } from "./interface-churn.js";
import { isTestPath } from "./test-path.js";
import { touchedModules } from "./touched-modules.js";
import type { ModuleHomes } from "./touched-modules.js";

const MIN_MODULE_COMMITS_FLOOR = 5;
const MIN_MODULE_COMMITS_SHARE = 0.01;
const MAX_PARTNERS = 5;

/**
 * Fewest counted commits a module needs to be ranked by its cohesion: 1% of
 * the `couplingCommits`, at least 5, so the floor grows with the window.
 */
export const minModuleCommitsFor = (couplingCommits: number): number =>
  Math.max(
    MIN_MODULE_COMMITS_FLOOR,
    Math.ceil(MIN_MODULE_COMMITS_SHARE * couplingCommits),
  );

type Tally = {
  readonly kind: ModuleRef["kind"];
  files: number;
  testFiles: number;
  commits: number;
  localCommits: number;
  /** Shared commits per other module path. */
  readonly shared: Map<string, number>;
};

/** Ranked modules first, then the other measured ones, then those without commits. */
const groupOf = (module: Module, minModuleCommits: number): number => {
  if (module.cohesion === null) {
    return 2;
  }
  return module.commits >= minModuleCommits && !module.testOnly ? 0 : 1;
};

const byCohesion = (a: Module, b: Module): number =>
  (a.cohesion ?? 0) - (b.cohesion ?? 0) ||
  b.commits - a.commits ||
  Order.String(a.path, b.path);

const byPartnerStrength = (
  a: Module["partners"][number],
  b: Module["partners"][number],
): number => b.sharedCommits - a.sharedCommits || Order.String(a.path, b.path);

const tallyFiles = (
  refs: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, Tally> => {
  const tallies = new Map<string, Tally>();
  for (const [file, { path, kind }] of refs) {
    const tally = tallies.get(path) ?? {
      kind,
      files: 0,
      testFiles: 0,
      commits: 0,
      localCommits: 0,
      shared: new Map(),
    };
    tally.files += 1;
    tally.testFiles += isTestPath(file) ? 1 : 0;
    tallies.set(path, tally);
  }
  return tallies;
};

/** Credits one change, given the distinct modules it touched, to each of them. */
const countCommit = (
  touched: ReadonlySet<string>,
  tallies: ReadonlyMap<string, Tally>,
): void => {
  for (const path of touched) {
    const tally = tallies.get(path);
    if (tally === undefined) {
      continue;
    }
    tally.commits += 1;
    if (touched.size === 1) {
      tally.localCommits += 1;
    }
    for (const other of touched) {
      if (other !== path) {
        tally.shared.set(other, (tally.shared.get(other) ?? 0) + 1);
      }
    }
  }
};

const toModule = (
  path: string,
  tally: Tally,
  churn: InterfaceChurn,
  modulePaths: ReadonlySet<string>,
): Module => {
  const testOnly = tally.testFiles === tally.files;
  return {
    path,
    kind: tally.kind,
    files: tally.files,
    testOnly,
    commits: tally.commits,
    localCommits: tally.localCommits,
    cohesion:
      tally.commits === 0
        ? null
        : roundReported(tally.localCommits / tally.commits),
    partners: [...tally.shared]
      .map(([partner, sharedCommits]) => ({
        path: partner,
        sharedCommits,
        contractsOnly: !modulePaths.has(partner),
      }))
      .toSorted(byPartnerStrength)
      .slice(0, MAX_PARTNERS),
    ...churn,
    leakyInterface: isLeakyInterface(churn, testOnly),
    depth: null,
    trend: null,
  };
};

/**
 * Measures every module over the counted commits (see `countedChanges`) of
 * `history`; `homes` maps every code file to its module and every contract
 * file to the module it lives in (a contract counts as a touch of its
 * module, never for its size), and
 * `interfaces` maps every module path to its measured interface churn (see
 * `measureInterfaces`; a module missing there has none).
 *
 * A module's cohesion is the share of its commits that touched no other
 * module. The order is the one documented on `Report.modules`; a module is
 * ranked when it has at least `minModuleCommits` commits and is not test-only.
 */
export const measureModules = (
  history: Pick<History, "changes" | "paths">,
  homes: ModuleHomes,
  minModuleCommits: number,
  interfaces: ReadonlyMap<string, InterfaceChurn>,
): ReadonlyArray<Module> => {
  const tallies = tallyFiles(homes.modules);
  for (const touched of touchedModules(history, homes)) {
    countCommit(touched, tallies);
  }
  const modulePaths = new Set(tallies.keys());
  return [...tallies]
    .map(([path, tally]) =>
      toModule(path, tally, interfaces.get(path) ?? NO_INTERFACE, modulePaths),
    )
    .toSorted(
      (a, b) =>
        groupOf(a, minModuleCommits) - groupOf(b, minModuleCommits) ||
        byCohesion(a, b),
    );
};
