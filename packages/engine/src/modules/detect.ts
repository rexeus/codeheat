// Owns which module each universe file belongs to.
import { splitByDirectory } from "./directory-split.js";
import { packageOf } from "./package-directories.js";
import { isTestPath } from "./test-path.js";

/** The module a file belongs to. */
export type ModuleRef = {
  /** Repository-relative directory; "." for files at the repository root. */
  readonly path: string;
  readonly kind: "package" | "directory";
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
    const home = packageOf(file, packages);
    if (home === undefined) {
      outside.push(file);
    } else {
      assigned.set(file, { path: home, kind: "package" });
    }
  }
  return new Map([...assigned, ...directoryModules(outside)]);
};

/**
 * A module that holds more than this percentage of the universe files is
 * split by directory (see `splitDominant`). A module that big makes the
 * module view useless: nearly every commit stays inside it, so its cohesion
 * says nothing, and it has no partners worth naming.
 */
const DOMINANT_MODULE_PERCENT = 70;

/**
 * A module with fewer files than this is never split, however large its share:
 * a small repository has no module view worth refining, and pieces of a few
 * files each could never reach the commits that rank a module.
 */
const MIN_DOMINANT_MODULE_FILES = 20;

type ModuleFiles = {
  readonly ref: ModuleRef;
  readonly files: ReadonlyArray<string>;
};

const filesByModule = (
  assigned: ReadonlyMap<string, ModuleRef>,
): ReadonlyArray<ModuleFiles> => {
  const grouped = new Map<string, { ref: ModuleRef; files: Array<string> }>();
  for (const [file, ref] of assigned) {
    const group = grouped.get(ref.path) ?? { ref, files: [] };
    group.files.push(file);
    grouped.set(ref.path, group);
  }
  return [...grouped.values()];
};

/**
 * The module to split: the one holding at least `MIN_DOMINANT_MODULE_FILES`
 * files and more than the dominant share of all. A package is spared when
 * another package with code exists, because manifests are boundaries someone
 * declared, and a package that merely is the largest of several is not a module
 * to dissolve. A package of test code alone (a fixture's manifest) declares no
 * such boundary.
 */
const dominantModule = (
  assigned: ReadonlyMap<string, ModuleRef>,
): ModuleFiles | undefined => {
  const modules = filesByModule(assigned);
  const dominant = modules.find(
    ({ files }) =>
      files.length >= MIN_DOMINANT_MODULE_FILES &&
      100 * files.length > DOMINANT_MODULE_PERCENT * assigned.size,
  );
  const hasOtherPackage = modules.some(
    ({ ref, files }) =>
      ref.path !== dominant?.ref.path &&
      ref.kind === "package" &&
      !files.every((file) => isTestPath(file)),
  );
  return dominant?.ref.kind === "package" && hasOtherPackage
    ? undefined
    : dominant;
};

/**
 * Splits the module that holds more than the dominant share of the files with
 * the directory rule, and again while one of the parts does, until none does
 * or the dominant module has no directories to split by.
 */
const splitDominant = (
  assigned: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, ModuleRef> => {
  const dominant = dominantModule(assigned);
  if (dominant === undefined) {
    return assigned;
  }
  const parts = directoryModules(dominant.files);
  const splits = new Set([...parts.values()].map(({ path }) => path)).size > 1;
  return splits ? splitDominant(new Map([...assigned, ...parts])) : assigned;
};

/**
 * Assigns every file to a module: its nearest enclosing package (a directory
 * in `packages`), otherwise a directory module. When that yields fewer than
 * two modules, all files are regrouped by directory instead, because a single
 * module is trivially cohesive and says nothing. A module that still holds
 * more than 70 % of the files, and has at least 20, is split by directory as
 * well (see `splitDominant`), unless it is a package and other packages with
 * code exist.
 */
export const detectModules = (
  files: ReadonlyArray<string>,
  packages: ReadonlySet<string>,
): ReadonlyMap<string, ModuleRef> => {
  const assigned = packagesThenDirectories(files, packages);
  const moduleCount = new Set([...assigned.values()].map(({ path }) => path))
    .size;
  return splitDominant(moduleCount < 2 ? directoryModules(files) : assigned);
};
