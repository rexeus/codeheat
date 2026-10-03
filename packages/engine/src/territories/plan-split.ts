// Owns the decision whether a part of the code splits into its folders, and
// into which: too big, or its folders change independently; folders that
// change together stay together.
import { isTestPath } from "../modules/test-path.js";
import { MIN_CHILD, cutByFolders } from "./folders.js";
import type { FolderCut } from "./folders.js";
import { keepTogether } from "./keep-together.js";
import type { Tally, Together } from "./keep-together.js";
import { openKids } from "./open-kids.js";
import type { Weight } from "./open-kids.js";
import {
  TOO_BIG_SHARE,
  changesTouching,
  directoriesOf,
  heatOf,
  isHotFolder,
} from "./part.js";
import type { Evidence, Part } from "./part.js";
import { reasonOf } from "./split-reason.js";
import type { Why } from "./split-reason.js";
import { ownersOf, tallyParts } from "./tally-parts.js";

/** A part's folders change independently when at least this share of the changes touching it stay inside one folder. */
const INDEPENDENT_SHARE = 0.7;
/** A folder counts as active in a part with at least this many of its changes. */
const MIN_ACTIVE_CHANGES = 3;
/** A part smaller than this share of the files and of the changes is not worth a split. */
const NEGLIGIBLE_FILES = 0.005;
const NEGLIGIBLE_CHANGES = 0.02;

/** A part's decision to split: its children, why, and how much the split is worth. */
export type Split = {
  readonly kids: ReadonlyArray<Part>;
  readonly reason: string;
  /** Larger splits come first. */
  readonly value: number;
};

/** The folders `part` would split into: a group's or bucket's own members, else the child folders of its directory. */
const cutOf = (
  part: Part,
  packages: ReadonlySet<string>,
  evidence: Evidence,
): FolderCut =>
  part.kind === "group" || part.kind === "more"
    ? {
        base: part.base,
        big: new Map(part.members.map(({ path, files }) => [path, files])),
        rest: part.rest,
      }
    : cutByFolders(part.path, part.files, packages, (folder, files) =>
        isHotFolder(evidence, folder, files),
      );

type Verdict = {
  readonly touching: ReadonlySet<number>;
  readonly tally: Tally;
  /** Share of the changes that stayed inside one part; undefined without changes. */
  readonly share: number | undefined;
  readonly tooBig: boolean;
  readonly independent: boolean;
  /** A bucket whose folders have enough changes to be shown. */
  readonly bucket: boolean;
  /** The folders with enough changes to count as active, busiest first. */
  readonly active: ReadonlyArray<string>;
};

/** What the changes say about splitting `part` into the folders of `cut`. */
const judge = (part: Part, cut: FolderCut, evidence: Evidence): Verdict => {
  const size = part.files.length;
  const touching = changesTouching(evidence, part.files);
  const { single, per, pair } = tallyParts(touching, ownersOf(cut), evidence);
  const share = touching.size === 0 ? undefined : single / touching.size;
  const enough = touching.size >= evidence.minChanges;
  const tooBig =
    size / evidence.total > TOO_BIG_SHARE ||
    (size > evidence.sizeBound && enough);
  const active = [...cut.big.keys()]
    .filter((key) => (per.get(key) ?? 0) >= MIN_ACTIVE_CHANGES)
    .toSorted((a, b) => (per.get(b) ?? 0) - (per.get(a) ?? 0));
  const independent =
    share !== undefined &&
    enough &&
    share >= INDEPENDENT_SHARE &&
    active.length >= 2 &&
    part.kind !== "group";
  const bucket = part.kind === "more" && (tooBig || independent || enough);
  return {
    touching,
    tally: { per, pair },
    share,
    tooBig,
    independent,
    bucket,
    active,
  };
};

const alone = (folders: ReadonlyArray<string>): ReadonlyArray<Together> =>
  folders.map((folder) => ({
    folders: [folder],
    link: { shared: 0, jaccard: 0 },
  }));

/**
 * The groups the folders of `cut` form: test-only folders stay alone, a
 * group's own members are never regrouped, and a part never splits into one
 * group (undefined when it would and is not too big).
 */
const groupsOf = (
  part: Part,
  cut: FolderCut,
  { tally, tooBig }: Pick<Verdict, "tally" | "tooBig">,
  isRoot: boolean,
): ReadonlyArray<Together> | undefined => {
  const tests = new Set(
    [...cut.big]
      .filter(([, files]) => files.every((file) => isTestPath(file)))
      .map(([key]) => key),
  );
  const code = [...cut.big.keys()].filter((key) => !tests.has(key));
  const together =
    part.kind === "group" ? alone(code) : keepTogether(code, tally);
  const unsplit = together.length < 2 && cut.rest.length === 0 && !isRoot;
  if (unsplit && !tooBig) {
    return undefined;
  }
  return [...(unsplit ? alone(code) : together), ...alone([...tests])];
};

type Context = {
  readonly part: Part;
  readonly cut: FolderCut;
  readonly evidence: Evidence;
  readonly isRoot: boolean;
};

const whyOf = (
  { part, cut, evidence, isRoot }: Context,
  verdict: Verdict,
  groups: ReadonlyArray<Together>,
): Why => {
  const kind =
    (isRoot && "first-cut") ||
    (verdict.independent && "independent") ||
    (part.kind === "more" && !verdict.tooBig && "bucket") ||
    "size";
  return {
    kind,
    base: cut.base,
    files: part.files.length,
    total: evidence.total,
    changes: verdict.touching.size,
    minChanges: evidence.minChanges,
    share: verdict.share,
    busiest: verdict.active.slice(0, 2),
    parts: cut.big.size,
    together: groups
      .filter(({ folders }) => folders.length > 1)
      .map(({ folders }) => folders),
  };
};

/** Whether the verdict calls for a split: the root always splits, a negligible part never. */
const worthSplitting = (
  { part, evidence, isRoot }: Context,
  verdict: Verdict,
): boolean => {
  const negligible =
    part.files.length < NEGLIGIBLE_FILES * evidence.total &&
    verdict.touching.size < NEGLIGIBLE_CHANGES * evidence.changeCount;
  return (
    isRoot ||
    (!negligible && (verdict.tooBig || verdict.independent || verdict.bucket))
  );
};

/** How much a split is worth: big, busy, and hot parts first, independence a bonus, buckets half. */
const valueOf = (
  { part, evidence }: Context,
  { touching, independent, share }: Verdict,
): number => {
  const gain = independent ? Math.max(0, (share ?? 0) - 0.5) : 0;
  const activity = touching.size / Math.max(1, evidence.changeCount);
  const heat =
    evidence.totalHeat === 0
      ? 0
      : heatOf(evidence, part.files, directoriesOf(part)) / evidence.totalHeat;
  return (
    (part.files.length / evidence.total + activity + heat) *
    (0.25 + gain) *
    (part.kind === "more" ? 0.5 : 1)
  );
};

/** How much heat, how many changes, and how many files a group of folders holds: the stronger open first, in that order. */
const weightOf = (
  folders: ReadonlyArray<string>,
  { cut, evidence }: Context,
  { tally }: Verdict,
): Weight => [
  heatOf(
    evidence,
    folders.flatMap((key) => cut.big.get(key) ?? []),
    folders,
  ),
  folders.reduce((sum, key) => sum + (tally.per.get(key) ?? 0), 0),
  folders.reduce((sum, key) => sum + (cut.big.get(key)?.length ?? 0), 0),
];

/**
 * Whether `part` splits, and into what. The root always splits (its first cut
 * is the coarsest detail). Any other part splits when it is too big (more
 * than 40 % of the universe, or above `min(150, max(50, files / 4))` files
 * with enough changes), or when its folders change independently (at least
 * 70 % of the changes touching it stay inside one folder, over at least
 * `minChanges` changes and two active folders; a group is never judged by
 * this), or when it is a bucket whose folders have enough changes. Folders
 * whose changes overlap stay together (see `keepTogether`); a part never
 * splits into one group. Test code that belongs to no code is a part of its
 * own and splits no further.
 */
export const planSplit = (
  part: Part,
  evidence: Evidence,
  packages: ReadonlySet<string>,
  isRoot: boolean,
): Split | undefined => {
  if (
    part.kind === "other" ||
    part.kind === "tests" ||
    part.files.length < 2 * MIN_CHILD
  ) {
    return undefined;
  }
  const cut = cutOf(part, packages, evidence);
  if (cut.big.size < 2 && !isRoot && part.kind !== "more") {
    return undefined;
  }
  const context = { part, cut, evidence, isRoot };
  const verdict = judge(part, cut, evidence);
  const groups = worthSplitting(context, verdict)
    ? groupsOf(part, cut, verdict, isRoot)
    : undefined;
  return groups === undefined
    ? undefined
    : {
        kids: openKids(groups, { cut, packages }, (folders) =>
          weightOf(folders, context, verdict),
        ),
        reason: reasonOf(whyOf(context, verdict, groups)),
        value: valueOf(context, verdict),
      };
};
