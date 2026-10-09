// Owns the parts a split opens: the strongest folders or groups of folders,
// the loose files, and what waits: a bucket of smaller folders.
import { folderPart } from "./folders.js";
import type { FolderCut } from "./folders.js";
import { groupPath } from "./group-path.js";
import type { Together } from "./keep-together.js";
import type { Part } from "./part.js";

/** At most this many folders, groups, and a bucket open at once; the rest wait in a "smaller folders" bucket. */
const FANOUT = 8;

/** What ranks a group of folders for opening: its heat, its changes, its files; compared in that order. */
export type Weight = readonly [number, number, number];

const heavier = (a: Weight, b: Weight): number =>
  b[0] - a[0] || b[1] - a[1] || b[2] - a[2];

/** What the kids are cut from. */
export type Cut = {
  readonly cut: FolderCut;
  readonly packages: ReadonlySet<string>;
};

const foldersOf = (
  paths: ReadonlyArray<string>,
  { cut, packages }: Cut,
): ReadonlyArray<Part> =>
  paths.map((path) => folderPart(path, cut.big.get(path) ?? [], packages));

const groupPart = (paths: ReadonlyArray<string>, context: Cut): Part => {
  const members = foldersOf(paths, context);
  return {
    kind: "group",
    path: groupPath(members.map((member) => member.path)),
    files: members.flatMap((member) => member.files),
    members,
    base: context.cut.base,
  };
};

/** The bucket of the folders that wait. */
const bucketPart = (paths: ReadonlyArray<string>, context: Cut): Part => {
  const { cut } = context;
  const members = foldersOf(paths, context);
  return {
    kind: "more",
    path: cut.base,
    files: members.flatMap((member) => member.files),
    members,
    base: cut.base,
  };
};

/** The loose files of one directory, a node of their own named after it. */
const looseFiles = (directory: string, files: ReadonlyArray<string>): Part => ({
  kind: "files",
  path: directory,
  files,
  members: [],
  base: directory,
});

/** The nodes of loose files: those of the directory cut and those of each directory passed through, each named after its own directory. */
const leftover = ({ cut }: Cut): ReadonlyArray<Part> => [
  ...(cut.rest.length === 0 ? [] : [looseFiles(cut.base, cut.rest)]),
  ...cut.outer.map(({ directory, files }) => looseFiles(directory, files)),
];

/** Territories (loose files included) first, then the bucket. */
const roleOf = ({ kind }: Part): number => (kind === "more" ? 1 : 0);

/**
 * The parts that open now: the `weigh`tiest `FANOUT - 1` groups of folders
 * (all of them when there are at most `FANOUT`) and the loose files, and what
 * waits: a bucket of the other folders. Territories and loose files come
 * first, then the bucket.
 */
export const openKids = (
  groups: ReadonlyArray<Together>,
  context: Cut,
  weigh: (folders: ReadonlyArray<string>) => Weight,
): ReadonlyArray<Part> => {
  const { cut } = context;
  const ranked = groups
    .map(({ folders }) => ({ folders, weight: weigh(folders) }))
    .toSorted((a, b) => heavier(a.weight, b.weight))
    .map(({ folders }) => folders);
  const crowded = ranked.length > FANOUT;
  const opened = (crowded ? ranked.slice(0, FANOUT - 1) : ranked).map(
    (paths) => {
      const [only] = paths;
      return paths.length === 1 && only !== undefined
        ? folderPart(only, cut.big.get(only) ?? [], context.packages)
        : groupPart(paths, context);
    },
  );
  const bucket = crowded
    ? [bucketPart(ranked.slice(FANOUT - 1).flat(), context)]
    : [];
  return [...opened, ...bucket, ...leftover(context)].toSorted(
    (a, b) => roleOf(a) - roleOf(b),
  );
};
