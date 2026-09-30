import type { FileStats } from "@codeheat/engine";

/** One file, drawn as one tile. */
export type FileNode = {
  readonly kind: "file";
  readonly name: string;
  readonly path: string;
  readonly file: FileStats;
};

/** Many small files of one directory, drawn as one tile. */
export type AggregateNode = {
  readonly kind: "aggregate";
  readonly name: string;
  readonly directory: string;
  readonly count: number;
  /** The merged files, so filter and selection can still find them. */
  readonly paths: readonly string[];
  readonly loc: number;
  /** The hottest score among the merged files, so no hotspot hides in the tile. */
  readonly score: number;
};

export type DirectoryNode = {
  readonly kind: "directory";
  readonly name: string;
  readonly path: string;
  readonly children: readonly TreeNode[];
};

export type LeafNode = FileNode | AggregateNode;
export type TreeNode = DirectoryNode | LeafNode;

/** Above this many files, small files are merged to keep the SVG light. */
const AGGREGATION_FILE_THRESHOLD = 8000;
/** Files below this share of the total LOC count as small. */
const SMALL_FILE_LOC_SHARE = 0.0002;

type DirectoryDraft = {
  readonly name: string;
  readonly path: string;
  readonly directories: Map<string, DirectoryDraft>;
  readonly files: FileNode[];
};

const draftDirectory = (name: string, path: string): DirectoryDraft => ({
  name,
  path,
  directories: new Map(),
  files: [],
});

const insertFile = (root: DirectoryDraft, file: FileStats): void => {
  const segments = file.path.split("/");
  const name = segments.pop() ?? file.path;
  let directory = root;
  for (const segment of segments) {
    const path =
      directory.path === "" ? segment : `${directory.path}/${segment}`;
    let next = directory.directories.get(segment);
    if (next === undefined) {
      next = draftDirectory(segment, path);
      directory.directories.set(segment, next);
    }
    directory = next;
  }
  directory.files.push({ kind: "file", name, path: file.path, file });
};

const aggregate = (
  directory: string,
  files: readonly FileNode[],
): AggregateNode => ({
  kind: "aggregate",
  name: `${files.length} small files`,
  directory,
  count: files.length,
  paths: files.map(({ path }) => path),
  loc: files.reduce((sum, { file }) => sum + file.loc, 0),
  // A reduce, not Math.max(...scores): spreading 125k+ arguments overflows the stack.
  score: files.reduce((hottest, { file }) => Math.max(hottest, file.score), 0),
});

type Aggregation = {
  /** Files with fewer lines than this are merged; 0 merges nothing. */
  readonly smallerThan: number;
  /** Files that must stay individual tiles. */
  readonly keep: ReadonlySet<string>;
};

const mergeSmallFiles = (
  directory: string,
  files: readonly FileNode[],
  { smallerThan, keep }: Aggregation,
): LeafNode[] => {
  const small: FileNode[] = [];
  const kept: FileNode[] = [];
  for (const node of files) {
    const isSmall = node.file.loc < smallerThan && !keep.has(node.path);
    (isSmall ? small : kept).push(node);
  }
  return small.length < 2 ? [...files] : [...kept, aggregate(directory, small)];
};

const finish = (
  draft: DirectoryDraft,
  aggregation: Aggregation,
): DirectoryNode => {
  const directories = [...draft.directories.values()].map((child) =>
    finish(child, aggregation),
  );
  const children: TreeNode[] = [
    ...directories,
    ...mergeSmallFiles(draft.path, draft.files, aggregation),
  ];
  const [only] = children;
  if (
    only?.kind === "directory" &&
    children.length === 1 &&
    draft.path !== ""
  ) {
    return { ...only, name: `${draft.name}/${only.name}` };
  }
  return { kind: "directory", name: draft.name, path: draft.path, children };
};

/**
 * Groups files by directory. A directory whose only child is a directory is
 * merged into it (`src/main/java` is one group), so labels stay readable.
 *
 * Above 8,000 files, small files merge into one aggregate tile per directory,
 * except files listed in `keep` (the files a user can select through a coupling).
 */
export const buildTree = (
  files: readonly FileStats[],
  keep: ReadonlySet<string>,
): DirectoryNode => {
  const root = draftDirectory("", "");
  for (const file of files) {
    insertFile(root, file);
  }
  const totalLoc = files.reduce((sum, file) => sum + file.loc, 0);
  const smallerThan =
    files.length > AGGREGATION_FILE_THRESHOLD
      ? totalLoc * SMALL_FILE_LOC_SHARE
      : 0;
  return finish(root, { smallerThan, keep });
};
