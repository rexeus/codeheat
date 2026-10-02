// Owns where contract files live among the modules. Modules are detected from
// code files alone, so a contract never decides what a module is or how big it
// is; it only counts as a place a commit touched.
import type { ModuleRef } from "../modules/detect.js";

const ROOT: ModuleRef = { path: ".", kind: "directory" };

/** The parent directory of a repository-relative path; "." at the top. */
const parentOf = (path: string): string => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "." : path.slice(0, cut);
};

const nearestModule = (
  directory: string,
  byPath: ReadonlyMap<string, ModuleRef>,
): ModuleRef =>
  byPath.get(directory) ??
  (directory === "." ? ROOT : nearestModule(parentOf(directory), byPath));

/**
 * Maps every contract file to the nearest module that lies above it (a
 * module's path is the directory of its package or its directory module), or
 * to the root when none does. `modules` maps each code file to its module.
 */
export const contractHomes = (
  contracts: ReadonlyArray<string>,
  modules: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, ModuleRef> => {
  const byPath = new Map([...modules.values()].map((ref) => [ref.path, ref]));
  return new Map(
    contracts.map((contract) => [
      contract,
      nearestModule(parentOf(contract), byPath),
    ]),
  );
};
