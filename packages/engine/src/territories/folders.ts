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
  /** Child folders with at least `MIN_CHILD` files, by directory. */
  readonly big: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Files directly in `base` and the files of smaller folders. */
  readonly rest: ReadonlyArray<string>;
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

/** The files below `base` grouped by their first folder: folders with enough files, and the loose files. */
const groupByFolder = (
  base: string,
  files: ReadonlyArray<string>,
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
    if (inside.length >= MIN_CHILD) {
      big.set(folder, inside);
    } else {
      rest.push(...inside);
    }
  }
  return { big, rest };
};

/** The child folders of `directory` (after descending through single subfolders) and the loose files. */
export const cutByFolders = (
  directory: string,
  files: ReadonlyArray<string>,
  packages: ReadonlySet<string>,
): FolderCut => {
  const base = descend(directory, files, packages);
  return { base, ...groupByFolder(base, files) };
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
