// Owns which module each universe file belongs to.
import { splitByDirectory } from "./directory-split.js";

/** The module a file belongs to. */
export type ModuleRef = {
  /** Repository-relative directory; "." for files at the repository root. */
  readonly path: string;
  readonly kind: "package" | "directory";
};

/** The directories above a file, nearest first, without the repository root. */
const enclosingDirectories = (file: string): ReadonlyArray<string> => {
  const parts = file.split("/").slice(0, -1);
  return parts.map((_, index) =>
    parts.slice(0, parts.length - index).join("/"),
  );
};

const directoryModules = (
  files: ReadonlyArray<string>,
): ReadonlyMap<string, ModuleRef> =>
  new Map(
    [...splitByDirectory(files)].map(([file, path]) => [
      file,
      { path, kind: "directory" },
    ]),
  );

/** Each file joins its nearest enclosing package; files outside every package group by directory. */
const packagesThenDirectories = (
  files: ReadonlyArray<string>,
  packages: ReadonlySet<string>,
): ReadonlyMap<string, ModuleRef> => {
  const assigned = new Map<string, ModuleRef>();
  const outside: Array<string> = [];
  for (const file of files) {
    const home = enclosingDirectories(file).find((directory) =>
      packages.has(directory),
    );
    if (home === undefined) {
      outside.push(file);
    } else {
      assigned.set(file, { path: home, kind: "package" });
    }
  }
  return new Map([...assigned, ...directoryModules(outside)]);
};

/**
 * Assigns every file to a module: its nearest enclosing package (a directory
 * in `packages`), otherwise a directory module. When that yields fewer than
 * two modules, all files are regrouped by directory instead, because a single
 * module is trivially cohesive and says nothing.
 */
export const detectModules = (
  files: ReadonlyArray<string>,
  packages: ReadonlySet<string>,
): ReadonlyMap<string, ModuleRef> => {
  const assigned = packagesThenDirectories(files, packages);
  const moduleCount = new Set([...assigned.values()].map(({ path }) => path))
    .size;
  return moduleCount < 2 ? directoryModules(files) : assigned;
};
