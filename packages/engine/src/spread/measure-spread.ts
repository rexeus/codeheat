// Owns how far a change spreads in one analysis: the change radius over the
// modules and the propagation cost over the co-change graph of the files.
import { countedChanges } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import type { Coupling, FileStats } from "../model/analysis.js";
import type { ChangeRadius, PropagationCost } from "../model/change-radius.js";
import type { ContractFile } from "../model/contract-file.js";
import type { Module } from "../model/module.js";
import { measureRadius } from "./change-radius.js";
import { propagationCost } from "./propagation-cost.js";

/** How many counted changes (see `countedChanges`) touched each path of `history`. */
const countedChangesPerPath = ({
  changes,
  paths,
}: Pick<History, "changes" | "paths">): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const change of countedChanges(changes)) {
    for (const id of change.files) {
      const path = paths[id] ?? "";
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }
  return counts;
};

/**
 * Measures the spread of the window `history` covers: `touched` are the
 * modules each of its counted changes touched (see `touchedModules`). Returns the report's
 * `changeRadius` and `propagationCost`, and the `modules` with their
 * `radius` set.
 */
export const measureSpread = (
  history: Pick<History, "changes" | "paths">,
  touched: ReadonlyArray<ReadonlySet<string>>,
  measured: {
    readonly modules: ReadonlyArray<Module>;
    readonly files: ReadonlyArray<FileStats>;
    readonly contracts: ReadonlyArray<ContractFile>;
  },
  couplings: ReadonlyArray<Coupling>,
): {
  readonly modules: ReadonlyArray<Module>;
  readonly changeRadius: ChangeRadius | null;
  readonly propagationCost: PropagationCost | null;
} => {
  const radius = measureRadius(touched, measured.modules);
  const counted = countedChangesPerPath(history);
  return {
    modules: radius.modules,
    changeRadius: radius.changeRadius,
    propagationCost: propagationCost(
      [
        ...measured.files.map(({ path, test }) => ({
          path,
          changes: counted.get(path) ?? 0,
          test,
        })),
        ...measured.contracts.map(({ path }) => ({
          path,
          changes: counted.get(path) ?? 0,
          test: false,
        })),
      ],
      couplings,
    ),
  };
};
