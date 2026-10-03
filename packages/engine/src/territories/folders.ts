// Owns cutting files into folders: the child folders of a directory, with
// chains of single subfolders counted as one step that stop at a package.
import { isTestPath } from "../modules/test-path.js";
import type { Part } from "./part.js";

/** A child folder with fewer files than this is no territory; its files stay loose. */
export const MIN_CHILD = 3;

/** The child folders of a directory and the files that belong to none. */
export type FolderCut = {
  /** The directory the children sit in. */
  readonly base: string;
  /** Child folders with at least `MIN_CHILD` files, or fewer that are hot (see `MIN_VISIBLE_HEAT`), by directory. */
  readonly big: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Files directly in `base` and the files of smaller folders. */
  readonly rest: ReadonlyArray<string>;
};

/** The directories above a file, the repository root ("") first and the file's own directory last. */
export const ancestorDirectories = (file: string): ReadonlyArray<string> => {
  const parts = file.split("/").slice(0, -1);
  return Array.from({ length: parts.length + 1 }, (_, length) =>
    parts.slice(0, length).join("/"),
  );
};

const below = (directory: string, file: string): string =>
  directory === "" ? file : file.slice(directory.length + 1);

const headOf = (relative: string): string =>
  relative.slice(0, relative.indexOf("/"));

const join = (directory: string, name: string): string =>
  directory === "" ? name : `${directory}/${name}`;

/**
 * `directory` extended through every single subfolder that holds all the files
 * and none directly, stopping at a package: its directory is a boundary
 * someone declared.
 */
const descend = (
  directory: string,
  files: ReadonlyArray<string>,
  packages: ReadonlySet<string>,
): string => {
  const relatives = files.map((file) => below(directory, file));
  const heads = new Set(
    relatives.filter((name) => name.includes("/")).map((name) => headOf(name)),
  );
  const [head] = heads;
  if (
    heads.size !== 1 ||
    head === undefined ||
    relatives.some((name) => !name.includes("/"))
  ) {
    return directory;
  }
  const next = join(directory, head);
  return packages.has(next) ? next : descend(next, files, packages);
};

/** Whether a folder with fewer than `MIN_CHILD` files is a part of its own: `isHot` says it holds enough of the heat. */
type IsHot = (folder: string, files: ReadonlyArray<string>) => boolean;

/** The files below `base` grouped by their first folder: folders with enough files or enough heat, and the loose files. */
const groupByFolder = (
  base: string,
  files: ReadonlyArray<string>,
  isHot: IsHot,
): Pick<FolderCut, "big" | "rest"> => {
  const grouped = new Map<string, Array<string>>();
  const rest: Array<string> = [];
  for (const file of files) {
    const relative = below(base, file);
    if (relative.includes("/")) {
      const folder = join(base, headOf(relative));
      const inside = grouped.get(folder) ?? [];
      inside.push(file);
      grouped.set(folder, inside);
    } else {
      rest.push(file);
    }
  }
  const big = new Map<string, ReadonlyArray<string>>();
  for (const [folder, inside] of grouped) {
    if (inside.length >= MIN_CHILD || isHot(folder, inside)) {
      big.set(folder, inside);
    } else {
      rest.push(...inside);
    }
  }
  return { big, rest };
};

/** How the child folders of a directory are cut. */
export type CutOptions = {
  readonly packages: ReadonlySet<string>;
  /** Whether a folder with fewer than `MIN_CHILD` files is a part of its own. */
  readonly isHot: IsHot;
  /**
   * When the directory has a single child folder and loose files (a package
   * with its `src` and a config file), cut that folder's children instead and
   * leave the loose files with theirs; never through a package.
   */
  readonly passThrough: boolean;
};

/** The child folders of `directory` (after descending through single subfolders) and the loose files. */
export const cutByFolders = (
  directory: string,
  files: ReadonlyArray<string>,
  options: CutOptions,
): FolderCut => {
  const { packages, isHot, passThrough } = options;
  const base = descend(directory, files, packages);
  const cut = { base, ...groupByFolder(base, files, isHot) };
  const [only] = cut.big;
  if (!passThrough || cut.big.size !== 1 || only === undefined) {
    return cut;
  }
  const [folder, inside] = only;
  if (packages.has(folder)) {
    return cut;
  }
  const deeper = cutByFolders(folder, inside, options);
  return { ...deeper, rest: [...deeper.rest, ...cut.rest] };
};

/** A folder part for the files below `path`, which is cut down to where the files actually branch unless it is a package. */
export const folderPart = (
  path: string,
  files: ReadonlyArray<string>,
  packages: ReadonlySet<string>,
): Part => ({
  kind: files.every((file) => isTestPath(file)) ? "tests" : "folder",
  path:
    path === "" || packages.has(path) ? path : descend(path, files, packages),
  files,
  members: [],
  base: "",
  rest: [],
});

/**
 * The part of the whole repository. Its path is "" unless one package holds
 * every file (the files all lie below a manifest's directory), which is then the
 * root's path.
 */
export const rootPart = (
  files: ReadonlyArray<string>,
  packages: ReadonlySet<string>,
): Part => {
  const top = descend("", files, packages);
  return folderPart(packages.has(top) ? top : "", files, packages);
};
