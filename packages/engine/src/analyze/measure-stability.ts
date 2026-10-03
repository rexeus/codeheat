// Owns the scaling signals of an analysis: what depends on what, read for the
// whole universe, set against how often each part changes.
import { Effect } from "effect";

import { dependentsByFile, loadDependencies } from "../imports/dependencies.js";
import { rootDependencies } from "../imports/import-graph.js";
import type { ImportGraph } from "../imports/import-graph.js";
import { isTestPath } from "../modules/test-path.js";
import type { Module } from "../report/module.js";
import { dependencyDirection } from "../stability/dependency-direction.js";
import { unstableInterfaces } from "../stability/unstable-interfaces.js";
import type { Universe } from "./measure.js";
import type { WindowHistories } from "./windows.js";

/**
 * The unstable interfaces and the dependency directions of the latest window. Test code is no dependent: a
 * test depending on code is expected, and a test's changes say nothing about
 * the design. Files the graph already read in full are not read again.
 */
export const measureStability = (
  graph: ImportGraph,
  universe: Universe,
  histories: WindowHistories,
  measured: {
    readonly modules: ReadonlyArray<Module>;
    readonly minModuleCommits: number;
  },
) =>
  Effect.gen(function* () {
    const code = universe.files
      .map((file) => file.path)
      .filter((path) => !isTestPath(path));
    const known = new Map(
      [...rootDependencies(graph)].filter(([file]) => !isTestPath(file)),
    );
    const dependencies = yield* loadDependencies(graph.sources, code, known);
    return {
      dependencyDirection: dependencyDirection(
        dependencies,
        universe.modules,
        measured.modules,
        measured.minModuleCommits,
      ),
      unstableInterfaces: unstableInterfaces(
        dependentsByFile(dependencies),
        histories.current,
        universe.modules,
      ),
    };
  });
