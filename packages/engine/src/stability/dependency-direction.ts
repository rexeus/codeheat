// Owns finding dependencies that point from stable code to volatile code, the
// way the Stable Dependencies Principle calls wrong: a module that rarely
// changes should not rest on one that changes often.
import { Order } from "effect";

import type { Dependencies } from "../imports/dependencies.js";
import type { ModuleRef } from "../modules/detect.js";
import type { DependencyDirection } from "../report/dependency-direction.js";
import type { Module } from "../report/module.js";

/**
 * How many times as many counted commits as the importing module the imported
 * one needs to have changed in for the import to count as pointing at
 * something volatile.
 */
export const MIN_VOLATILITY_RATIO = 2;

/** The report keeps this many edges, the ones with the most importing files first. */
const MAX_DEPENDENCY_DIRECTIONS = 50;

type Edge = { readonly from: string; readonly to: string };

/** The files of each module that import each other module, by `from -> to` edge. */
const importingFilesByEdge = (
  dependencies: Dependencies,
  modules: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, { edge: Edge; files: Set<string> }> => {
  const edges = new Map<string, { edge: Edge; files: Set<string> }>();
  for (const [file, loaded] of dependencies) {
    const from = modules.get(file)?.path;
    for (const target of loaded) {
      const to = modules.get(target)?.path;
      if (from !== undefined && to !== undefined && from !== to) {
        const key = `${from}\n${to}`;
        const known = edges.get(key) ?? {
          edge: { from, to },
          files: new Set(),
        };
        known.files.add(file);
        edges.set(key, known);
      }
    }
  }
  return edges;
};

const byImportingFiles = (
  a: DependencyDirection,
  b: DependencyDirection,
): number =>
  b.importingFiles - a.importingFiles ||
  b.toCommits - b.fromCommits - (a.toCommits - a.fromCommits) ||
  Order.String(a.from, b.from) ||
  Order.String(a.to, b.to);

const reasonFor = (
  { from, to }: Edge,
  importingFiles: number,
  fromCommits: number,
  toCommits: number,
): string =>
  `${importingFiles} ${importingFiles === 1 ? "file" : "files"} of ${from}, which changed in ${fromCommits} ${fromCommits === 1 ? "commit" : "commits"}, import ${to}, which changed in ${toCommits}`;

/**
 * The import edges between modules that point from a stable module to a
 * volatile one: `dependencies` says what each non-test file loads, `homes`
 * which module each file lives in, and `measured` how often each module
 * changed (`Module.commits`). An edge is flagged when neither module is
 * test-only, the imported one changed in at least `minModuleCommits` counted
 * commits (fewer say nothing about volatility), and in at least
 * `MIN_VOLATILITY_RATIO` times as many as the importing one, which may not
 * have changed at all. The `MAX_DEPENDENCY_DIRECTIONS` with the most importing
 * files come first, then the larger gap in commits, then path.
 */
export const dependencyDirection = (
  dependencies: Dependencies,
  homes: ReadonlyMap<string, ModuleRef>,
  measured: ReadonlyArray<Module>,
  minModuleCommits: number,
): ReadonlyArray<DependencyDirection> => {
  const commitsOf = new Map(
    measured
      .filter((module) => !module.testOnly)
      .map((module) => [module.path, module.commits]),
  );
  return [...importingFilesByEdge(dependencies, homes).values()]
    .flatMap(({ edge, files }): ReadonlyArray<DependencyDirection> => {
      const fromCommits = commitsOf.get(edge.from);
      const toCommits = commitsOf.get(edge.to);
      return fromCommits !== undefined &&
        toCommits !== undefined &&
        toCommits >= minModuleCommits &&
        toCommits >= MIN_VOLATILITY_RATIO * fromCommits
        ? [
            {
              ...edge,
              importingFiles: files.size,
              fromCommits,
              toCommits,
              reason: reasonFor(edge, files.size, fromCommits, toCommits),
            },
          ]
        : [];
    })
    .toSorted(byImportingFiles)
    .slice(0, MAX_DEPENDENCY_DIRECTIONS);
};
