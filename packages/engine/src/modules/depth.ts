// Owns module depth: how many lines of implementation sit behind each symbol
// a module exports. It reads the code as it is now, so it is measured once,
// whatever the windows.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import { adapterFor } from "../code/language-adapter.js";
import type { LanguageAdapter } from "../code/language-adapter.js";
import { createResolver } from "../imports/resolve.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import type { InventoryFile } from "../universe/inventory.js";
import type { ModuleRef } from "./detect.js";
import { isConfigFile } from "./entry-points.js";
import { countExportedSymbols } from "./exported-symbols.js";
import { isTestPath } from "./test-path.js";

/** Modules read at once; each reads one file at a time. */
const MODULE_CONCURRENCY = 16;

type ModuleDepth = NonNullable<Module["depth"]>;

type DepthOptions = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  /** The languages whose exports can be listed; modules in any other have no depth. */
  readonly adapters: ReadonlyArray<LanguageAdapter>;
  readonly files: ReadonlyArray<InventoryFile>;
  /** The module of every universe file. */
  readonly modules: ReadonlyMap<string, ModuleRef>;
  /** The entry points of every module (see `findEntryPoints`). */
  readonly entryPoints: ReadonlyMap<string, ReadonlyArray<string>>;
};

/** Lines of the files of each module that are neither entry points, test code, nor tool configuration. */
const implementationLinesByModule = ({
  files,
  modules,
  entryPoints,
}: DepthOptions): ReadonlyMap<string, number> => {
  const entries = new Set([...entryPoints.values()].flat());
  const lines = new Map<string, number>();
  for (const { path, complexity } of files) {
    const module = modules.get(path)?.path;
    if (
      module !== undefined &&
      !entries.has(path) &&
      !isTestPath(path) &&
      !isConfigFile(path)
    ) {
      lines.set(module, (lines.get(module) ?? 0) + complexity.loc);
    }
  }
  return lines;
};

const depthOf = (
  exports: number | undefined,
  implementationLines: number,
): ModuleDepth | undefined =>
  exports === undefined || exports === 0 || implementationLines === 0
    ? undefined
    : {
        exports,
        implementationLines,
        linesPerExport: roundReported(implementationLines / exports),
      };

/**
 * The depth of every module that has one, keyed by module path: its exported
 * symbols (see `countExportedSymbols`) against the lines of its
 * implementation. A module is absent when it has no entry points, an entry
 * point no adapter reads, no implementation lines (nothing to read for it), or
 * symbols that cannot be counted exactly.
 */
export const measureDepths = (
  options: DepthOptions,
): Effect.Effect<
  ReadonlyMap<string, ModuleDepth>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { root, adapters, modules, entryPoints } = options;
    const lines = implementationLinesByModule(options);
    const sources = {
      root,
      adapters,
      modules,
      resolve: createResolver({
        universe: new Set(modules.keys()),
        tracked: new Set(),
        packages: new Map(),
        ambiguous: new Set(),
        dependencies: new Set(),
      }),
    };
    const measurable = [...entryPoints].filter(
      ([module, entries]) =>
        (lines.get(module) ?? 0) > 0 &&
        entries.length > 0 &&
        entries.every((entry) => adapterFor(adapters, entry) !== undefined),
    );
    const measured = yield* Effect.forEach(
      measurable,
      ([module, entries]) =>
        Effect.map(
          countExportedSymbols(sources, module, entries),
          (exports) =>
            [module, depthOf(exports, lines.get(module) ?? 0)] as const,
        ),
      { concurrency: MODULE_CONCURRENCY },
    );
    return new Map(
      measured.flatMap(([module, depth]) =>
        depth === undefined ? [] : [[module, depth] as const],
      ),
    );
  });

/** `modules` with the depth measured for each, in the same order. */
export const withDepths = (
  modules: ReadonlyArray<Module>,
  depths: ReadonlyMap<string, ModuleDepth>,
): ReadonlyArray<Module> =>
  modules.map((module) => ({
    ...module,
    depth: depths.get(module.path) ?? null,
  }));
