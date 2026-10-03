// Owns how far a change spreads in one analysis: the change radius over the
// modules.
import type { ChangeRadius } from "../report/change-radius.js";
import type { Module } from "../report/module.js";
import { measureRadius } from "./change-radius.js";

/**
 * Measures the spread of the latest window: `touched` are the modules each
 * counted change touched (see `touchedModules`). Returns the report's
 * `changeRadius` and the `modules` with their `radius` set.
 */
export const measureSpread = (
  touched: ReadonlyArray<ReadonlySet<string>>,
  measured: { readonly modules: ReadonlyArray<Module> },
): {
  readonly modules: ReadonlyArray<Module>;
  readonly changeRadius: ChangeRadius | null;
} => measureRadius(touched, measured.modules);
