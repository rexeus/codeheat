// Owns the parts a split opens: the strongest folders or groups of folders,
// and what waits: a bucket of smaller folders, or the loose files.
import { folderPart } from "./folders.js";
import type { FolderCut } from "./folders.js";
import type { Together } from "./keep-together.js";
import type { Part } from "./part.js";

/** At most this many children open at once; the rest wait in a "smaller folders" bucket. */
const FANOUT = 8;

/** What the kids are cut from. */
export type Cut = {
  readonly cut: FolderCut;
  readonly packages: ReadonlySet<string>;
};

const filesOf = (
  keys: ReadonlyArray<string>,
  big: ReadonlyMap<string, ReadonlyArray<string>>,
): ReadonlyArray<string> => keys.flatMap((key) => big.get(key) ?? []);

const foldersOf = (
  paths: ReadonlyArray<string>,
  { cut, packages }: Cut,
): ReadonlyArray<Part> =>
  paths.map((path) => folderPart(path, cut.big.get(path) ?? [], packages));

const groupPart = (paths: ReadonlyArray<string>, context: Cut): Part => {
  const members = foldersOf(paths, context);
  return {
    kind: "group",
    path: members.map((member) => member.path).join(" + "),
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

const looseFiles = ({ cut }: Cut): Part => ({
  kind: "other",
  path: cut.base,
  files: cut.rest,
  members: [],
  base: cut.base,
  rest: [],
});

const leftover = (context: Cut): ReadonlyArray<Part> =>
  context.cut.rest.length > 0 ? [looseFiles(context)] : [];

/** Territories first, then test-only code, then buckets and loose files. */
const roleOf = ({ kind }: Part): number => {
  if (kind === "folder" || kind === "group") {
    return 0;
  }
  return kind === "tests" ? 1 : 2;
};

/**
 * The parts that open now: the `weigh`tiest `FANOUT - 1` groups of folders
 * (all of them when there are at most `FANOUT`), and what waits: a bucket of
 * the rest, or else the loose files. Territories come first, then test-only
 * code, then the bucket.
 */
export const openKids = (
  groups: ReadonlyArray<Together>,
  context: Cut,
  weigh: (folders: ReadonlyArray<string>) => number,
): ReadonlyArray<Part> => {
  const { cut } = context;
  const ranked = groups
    .map(({ folders }) => folders)
    .toSorted((a, b) => weigh(b) - weigh(a));
  const crowded = ranked.length > FANOUT;
  const opened = (crowded ? ranked.slice(0, FANOUT - 1) : ranked)
    .toSorted((a, b) => filesOf(b, cut.big).length - filesOf(a, cut.big).length)
    .map((paths) => {
      const [only] = paths;
      return paths.length === 1 && only !== undefined
        ? folderPart(only, cut.big.get(only) ?? [], context.packages)
        : groupPart(paths, context);
    });
  const waiting = crowded
    ? [bucketPart(ranked.slice(FANOUT - 1).flat(), context)]
    : leftover(context);
  return [...opened, ...waiting].toSorted((a, b) => roleOf(a) - roleOf(b));
};
