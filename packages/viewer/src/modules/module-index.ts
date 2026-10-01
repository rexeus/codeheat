import type { FileStats, Module } from "@codeheat/engine";

/** Finds the module of a file and the cohesion a set of files is drawn with. */
export type ModuleIndex = {
  /** The module of `path`; `undefined` when the report lists no such module (for example after `--limit`). */
  readonly moduleOf: (path: string) => Module | undefined;
  /**
   * The cohesion a tile of `paths` is colored by: the lowest known cohesion
   * among their modules, so a tile of merged files hides no attention case.
   * `null` when no module of them has data.
   */
  readonly cohesionOf: (paths: readonly string[]) => number | null;
};

export const indexModules = (
  files: readonly FileStats[],
  modules: readonly Module[],
): ModuleIndex => {
  const byPath = new Map(modules.map((module) => [module.path, module]));
  const moduleOfFile = new Map(
    files.map(({ path, module }) => [path, byPath.get(module)]),
  );
  const moduleOf = (path: string): Module | undefined => moduleOfFile.get(path);
  return {
    moduleOf,
    cohesionOf: (paths) => {
      const known = paths.flatMap((path) => moduleOf(path)?.cohesion ?? []);
      return known.length === 0 ? null : Math.min(...known);
    },
  };
};
