// Owns where contract files live among the modules. Modules are detected from
// code files alone, so a contract never decides what a module is or how big it
// is; it only counts as a place a commit touched.
import type { ModuleRef } from "../modules/detect.js";

/** The parent directory of a repository-relative path; "." at the top. */
const parentOf = (path: string): string => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "." : path.slice(0, cut);
};

/** The directories from the repository root down to the one holding `path`. */
const directoriesAbove = (path: string): ReadonlyArray<string> => {
  const parts = path.split("/").slice(0, -1);
  return [".", ...parts.map((_, index) => parts.slice(0, index + 1).join("/"))];
};

/** The nearest module at or above `directory`, if any. */
const enclosingModule = (
  directory: string,
  byPath: ReadonlyMap<string, ModuleRef>,
): ModuleRef | undefined =>
  byPath.get(directory) ??
  (directory === "."
    ? undefined
    : enclosingModule(parentOf(directory), byPath));

/**
 * Maps every contract file to the nearest module that lies above it (a
 * module's path is the directory of its package or its directory module). A
 * contract outside every module, such as a `spec/` folder beside two
 * packages, lives in the highest directory above it that holds no code, or in
 * its own directory when every one of them does; no module is made of it.
 * `modules` maps each code file to its module.
 */
export const contractHomes = (
  contracts: ReadonlyArray<string>,
  modules: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, ModuleRef> => {
  if (contracts.length === 0) {
    return new Map();
  }
  const byPath = new Map([...modules.values()].map((ref) => [ref.path, ref]));
  const codeDirectories = new Set(
    [...modules.keys()].flatMap((file) => directoriesAbove(file)),
  );
  return new Map(
    contracts.map((contract) => {
      const module = enclosingModule(parentOf(contract), byPath);
      const directory =
        directoriesAbove(contract).find(
          (candidate) => !codeDirectories.has(candidate),
        ) ?? parentOf(contract);
      return [contract, module ?? { path: directory, kind: "directory" }];
    }),
  );
};
