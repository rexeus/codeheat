// Owns the parts a split opens: the strongest folders or groups of folders,
// and what waits: a bucket of smaller folders, or the loose files.
import { folderPart } from "./folders.js";
import type { FolderCut } from "./folders.js";
import { groupPath } from "./group-path.js";
import type { Together } from "./keep-together.js";
import type { Part } from "./part.js";

/** At most this many children open at once; the rest wait in a "smaller folders" bucket. */
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
    rest: [],
  };
};

/** The bucket of the folders that wait, with the loose files of the directory. */
const bucketPart = (paths: ReadonlyArray<string>, context: Cut): Part => {
  const { cut } = context;
  const members = foldersOf(paths, context);
  return {
    kind: "more",
    path: cut.base,
    files: [...members.flatMap((member) => member.files), ...cut.rest],
    members,
    base: cut.base,
    rest: cut.rest,
  };
};

/** The loose files of one directory, a node of their own named after it. */
const looseFiles = (directory: string, files: ReadonlyArray<string>): Part => ({
  kind: "other",
  path: directory,
  files,
  members: [],
  base: directory,
  rest: [],
});

/** The nodes of loose files: those of the directory cut (unless a bucket holds them) and those of each directory passed through, each named after its own directory. */
const leftover = ({ cut }: Cut, restInBucket: boolean): ReadonlyArray<Part> => [
  ...(restInBucket || cut.rest.length === 0
    ? []
    : [looseFiles(cut.base, cut.rest)]),
  ...cut.outer.map(({ directory, files }) => looseFiles(directory, files)),
];

/** Territories first, then buckets and loose files. */
const roleOf = ({ kind }: Part): number =>
  kind === "folder" || kind === "group" ? 0 : 1;

/**
 * The parts that open now: the `weigh`tiest `FANOUT - 1` groups of folders
 * (all of them when there are at most `FANOUT`), and what waits: a bucket of
 * the rest, or else the loose files. Territories come first, then the bucket
 * and the loose files.
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
  return [...opened, ...bucket, ...leftover(context, crowded)].toSorted(
    (a, b) => roleOf(a) - roleOf(b),
  );
};
