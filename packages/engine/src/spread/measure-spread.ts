// Owns how far a change spreads in one analysis: the change radius over the
// modules and the propagation cost over the co-change graph of the files.
import type { ChangeRadius, PropagationCost } from "../report/change-radius.js";
import type { ContractFile } from "../report/contract-file.js";
import type { Module } from "../report/module.js";
import type { Coupling, FileStats } from "../report/report.js";
import { measureRadius } from "./change-radius.js";
import { propagationCost } from "./propagation-cost.js";

/**
 * Measures the spread of the latest window: `touched` are the modules each
 * counted change touched (see `touchedModules`). Returns the report's
 * `changeRadius` and `propagationCost`, and the `modules` with their
 * `radius` set.
 */
export const measureSpread = (
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
  return {
    modules: radius.modules,
    changeRadius: radius.changeRadius,
    propagationCost: propagationCost(
      [
        ...measured.files,
        ...measured.contracts.map(({ path, changes }) => ({
          path,
          changes,
          test: false,
        })),
      ],
      couplings,
    ),
  };
};
