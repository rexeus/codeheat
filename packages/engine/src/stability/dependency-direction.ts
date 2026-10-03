// Owns finding dependencies that point from stable code to volatile code, the
// way the Stable Dependencies Principle calls wrong: a module that rarely
// changes should not rest on one that changes often.
import { Order } from "effect";

import { countedChanges } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { Dependencies } from "../imports/dependencies.js";
import type { ModuleRef } from "../modules/detect.js";
import type { DependencyDirection } from "../report/dependency-direction.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";

/**
 * How many times as many counted commits as the importing module the imported
 * one needs to have changed in for the import to count as pointing at
 * something volatile.
 */
export const MIN_VOLATILITY_RATIO = 2;

/** The report keeps this many edges, the highest ranked first. */
const MAX_DEPENDENCY_DIRECTIONS = 50;

type Edge = {
  readonly from: string;
  readonly to: string;
  /** Each importing file with the files of `to` it imports. */
  readonly imports: Map<string, Set<string>>;
};

/** The import edges between modules, keyed by `from\nto`. */
const edgesOf = (
  dependencies: Dependencies,
  modules: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, Edge> => {
  const edges = new Map<string, Edge>();
  for (const [file, loaded] of dependencies) {
    const from = modules.get(file)?.path;
    for (const target of loaded) {
      const to = modules.get(target)?.path;
      if (from !== undefined && to !== undefined && from !== to) {
        const key = `${from}\n${to}`;
        const edge = edges.get(key) ?? {
          from,
          to,
          imports: new Map<string, Set<string>>(),
        };
        const known = edge.imports.get(file) ?? new Set<string>();
        edge.imports.set(file, known.add(target));
        edges.set(key, edge);
      }
    }
  }
  return edges;
};

/** The edges on which, in one commit touching `paths`, an importing file changed together with a file it imports. */
const edgesFeltIn = (
  paths: ReadonlySet<string>,
  edges: ReadonlyMap<string, Edge>,
  importerEdges: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlySet<string> =>
  new Set(
    [...paths].flatMap((file) =>
      (importerEdges.get(file) ?? []).filter((key) =>
        [...(edges.get(key)?.imports.get(file) ?? [])].some((target) =>
          paths.has(target),
        ),
      ),
    ),
  );

/**
 * Per edge, in how many counted commits an importing file changed together
 * with a file of the imported module that it imports: how often the dependency
 * was actually felt.
 */
const changedTogether = (
  edges: ReadonlyMap<string, Edge>,
  history: Pick<History, "changes" | "paths">,
): ReadonlyMap<string, number> => {
  const importerEdges = new Map<string, Array<string>>();
  for (const [key, { imports }] of edges) {
    for (const file of imports.keys()) {
      importerEdges.set(file, [...(importerEdges.get(file) ?? []), key]);
    }
  }
  const changed = new Map<string, number>();
  for (const change of countedChanges(history.changes)) {
    const paths = new Set(
      Array.from(change.files, (id) => history.paths[id] ?? ""),
    );
    for (const key of edgesFeltIn(paths, edges, importerEdges)) {
      changed.set(key, (changed.get(key) ?? 0) + 1);
    }
  }
  return changed;
};

/** Volatility of the imported module over the importer's, times in how many commits an importer changed with what it imports (log scale). */
const rankOf = ({ ratio, changesTogether: changed }: DependencyDirection) =>
  Math.log2(ratio) * Math.log2(1 + changed);

const byRank = (a: DependencyDirection, b: DependencyDirection): number =>
  rankOf(b) - rankOf(a) ||
  b.importingFiles - a.importingFiles ||
  Order.String(a.from, b.from) ||
  Order.String(a.to, b.to);

type Counts = {
  readonly importingFiles: number;
  readonly changesTogether: number;
  readonly fromCommits: number;
  readonly toCommits: number;
};

const reasonFor = (
  { from, to }: Edge,
  { importingFiles, changesTogether: changed, fromCommits, toCommits }: Counts,
): string =>
  `${importingFiles} ${importingFiles === 1 ? "file" : "files"} of ${from}, which changed in ${fromCommits} ${fromCommits === 1 ? "commit" : "commits"}, import ${to}, which changed in ${toCommits}; ${changed} ${changed === 1 ? "commit" : "commits"} changed an importer together with what it imports`;

/**
 * The import edges between modules that point from a stable module to a
 * volatile one: `dependencies` says what each non-test file loads, `homes`
 * which module each file lives in, `measured` how often each module changed
 * (`Module.commits`), and `history` which files changed in the same commits.
 * An edge is flagged when neither module is test-only, the imported one
 * changed in at least `minModuleCommits` counted commits (fewer say nothing
 * about volatility), and in at least `MIN_VOLATILITY_RATIO` times as many as
 * the importing one, which may not have changed at all.
 *
 * `ratio` is the imported module's commits over the importing one's (at least
 * 1). The edges rank by `log2(ratio) × log2(1 + changesTogether)`: how much more
 * volatile the imported side is, and in how many commits an importer really had to
 * move with it, so that every module importing the same framework does not
 * fill the list. Then more importing files and path break ties. The
 * `MAX_DEPENDENCY_DIRECTIONS` best come back.
 */
export const dependencyDirection = (
  inputs: {
    readonly dependencies: Dependencies;
    readonly homes: ReadonlyMap<string, ModuleRef>;
    readonly history: Pick<History, "changes" | "paths">;
  },
  measured: ReadonlyArray<Module>,
  minModuleCommits: number,
): ReadonlyArray<DependencyDirection> => {
  const commitsOf = new Map(
    measured
      .filter((module) => !module.testOnly)
      .map((module) => [module.path, module.commits]),
  );
  const edges = edgesOf(inputs.dependencies, inputs.homes);
  const changed = changedTogether(edges, inputs.history);
  return [...edges]
    .flatMap(([key, edge]): ReadonlyArray<DependencyDirection> => {
      const fromCommits = commitsOf.get(edge.from);
      const toCommits = commitsOf.get(edge.to);
      if (
        fromCommits === undefined ||
        toCommits === undefined ||
        toCommits < minModuleCommits ||
        toCommits < MIN_VOLATILITY_RATIO * fromCommits
      ) {
        return [];
      }
      const counts = {
        importingFiles: edge.imports.size,
        changesTogether: changed.get(key) ?? 0,
        fromCommits,
        toCommits,
      };
      return [
        {
          from: edge.from,
          to: edge.to,
          ...counts,
          ratio: roundReported(toCommits / Math.max(1, fromCommits)),
          reason: reasonFor(edge, counts),
        },
      ];
    })
    .toSorted(byRank)
    .slice(0, MAX_DEPENDENCY_DIRECTIONS);
};
