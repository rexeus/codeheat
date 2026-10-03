// Owns which modules a commit touched: the one reading of "this change reached
// that module" that cohesion, partners, the module coupling matrix, and
// cliques all count.
import { countedChanges } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { ModuleRef } from "./detect.js";

/** Where the files of the universe live: the modules of the code files, and the module each contract file lives in. */
export type ModuleHomes = {
  readonly modules: ReadonlyMap<string, ModuleRef>;
  readonly contracts: ReadonlyMap<string, ModuleRef>;
};

/**
 * For each counted change (see `countedChanges`) of `history`, in order, the
 * distinct module paths it touched. A code file counts for its module and a
 * contract file for the module it lives in, which is a place without a module
 * when no module encloses it; a path that is neither lives in `.`.
 */
export const touchedModules = (
  { changes, paths }: Pick<History, "changes" | "paths">,
  { modules, contracts }: ModuleHomes,
): ReadonlyArray<ReadonlySet<string>> => {
  const moduleOfId = paths.map(
    (path) => (modules.get(path) ?? contracts.get(path))?.path ?? ".",
  );
  return countedChanges(changes).map(
    (change) =>
      new Set(Array.from(change.files, (id) => moduleOfId[id] ?? ".")),
  );
};
