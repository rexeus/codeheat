// Owns the one line that says why a territory splits: what changed in the
// evidence, in words for someone who has never seen the repository.

import { TOO_BIG_SHARE } from "./part.js";

/** What the decision to split looked at. */
export type Why = {
  readonly kind: "first-cut" | "independent" | "bucket" | "size";
  /** The directory the parts sit in; names are shown relative to it. */
  readonly base: string;
  /** Files in the territory, and in the whole universe. */
  readonly files: number;
  readonly total: number;
  /** Changes that touched the territory, and the fewest at which they say something. */
  readonly changes: number;
  readonly minChanges: number;
  /** Share of those changes that stayed inside one part; undefined without changes. */
  readonly share: number | undefined;
  /** The two parts with the most changes, when the split is by independence. */
  readonly busiest: ReadonlyArray<string>;
  /** Parts shown one by one, of a bucket. */
  readonly parts: number;
  /** Folders that stay together, as each group's directories. */
  readonly together: ReadonlyArray<ReadonlyArray<string>>;
};

const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

const shortName = (base: string, path: string): string =>
  base !== "" && path.startsWith(`${base}/`)
    ? path.slice(base.length + 1)
    : path;

const togetherClause = ({
  changes,
  minChanges,
  share,
}: Pick<Why, "changes" | "minChanges" | "share">): string => {
  if (share === undefined || changes < minChanges) {
    return "too few changes to tell whether its parts change together";
  }
  return 1 - share >= 0.5
    ? `its parts still change together (${percent(1 - share)} of its changes touch more than one part)`
    : `most changes stay inside one part (${percent(share)}), but not enough to call them independent`;
};

const independentReason = (why: Why): string => {
  const names = why.busiest.map((path) => shortName(why.base, path));
  const size =
    why.total > 0 && why.files / why.total > TOO_BIG_SHARE
      ? `; it also holds ${why.files} code files`
      : "";
  return `${names.join(" and ")} change independently: ${percent(why.share ?? 0)} of the ${why.changes} changes touching it stay inside one part${size}`;
};

const sizeReason = (why: Why): string => {
  const all =
    why.files / why.total > TOO_BIG_SHARE
      ? `, ${percent(why.files / why.total)} of all code files`
      : "";
  return `${why.files} code files${all}; ${togetherClause(why)}`;
};

const mainReason = (why: Why): string => {
  if (why.kind === "first-cut") {
    return "the first cut: top-level folders";
  }
  if (why.kind === "independent") {
    return independentReason(why);
  }
  return why.kind === "bucket"
    ? `${why.parts} smaller folders, each shown on its own now`
    : sizeReason(why);
};

/** The reason a territory splits, with the folders that stay together named at the end. */
export const reasonOf = (why: Why): string => {
  const together = why.together
    .slice(0, 2)
    .map((folders) =>
      folders.map((path) => shortName(why.base, path)).join(" and "),
    );
  return together.length === 0
    ? mainReason(why)
    : `${mainReason(why)}; ${together.join(", ")} stay together`;
};
