// Owns deciding which commits belong to one logical change: the commits of a
// pull request, or of one ticket worked on within a short time.
import { MAX_COMMIT_FILES } from "../coupling/coupling.js";
import { pullRequestOf, ticketOf } from "./keys.js";
import type { LogicalChange } from "./logical-change.js";
import { Partition } from "./partition.js";

/** A real commit to group; grouping never sees mechanical commits. */
export type Candidate = {
  readonly sha: string;
  readonly subject: string;
  /** Commit time in seconds since the epoch. */
  readonly time: number;
  /** The ids of the files whose current file the commit touched. */
  readonly files: Uint32Array;
  /** The ids of the files it touched only in an earlier life. */
  readonly previousLives: Uint32Array;
  /** How many distinct universe files it touched, earlier lives included. */
  readonly size: number;
};

/** How the commits of a window were grouped. */
export type GroupedBy = "pr" | "ticket" | "mixed" | "commit";

/** The grouping of a window: its changes and what it rests on. */
export type Grouping = {
  readonly changes: ReadonlyArray<LogicalChange>;
  readonly by: GroupedBy;
  /** The most commits one change holds. */
  readonly largest: number;
};

/** Commits of one squash-merged pull request or ticket count as one change when they lie within this many seconds of the first. */
const SPAN = 14 * 24 * 60 * 60;
/**
 * A group of more commits than this is not one change: a branch that lives
 * for months, or a merge that pulled other people's work in. Its commits stay
 * apart.
 */
const MAX_GROUP_COMMITS = 30;

const groupBy = (
  candidates: ReadonlyArray<Candidate>,
  keyOf: (candidate: Candidate) => string | undefined,
): ReadonlyArray<ReadonlyArray<number>> => {
  const groups = new Map<string, Array<number>>();
  for (const [index, candidate] of candidates.entries()) {
    const key = keyOf(candidate);
    if (key !== undefined) {
      const members = groups.get(key) ?? [];
      members.push(index);
      groups.set(key, members);
    }
  }
  return [...groups.values()];
};

const timeOf = (candidates: ReadonlyArray<Candidate>, index: number): number =>
  candidates[index]?.time ?? 0;

/**
 * Splits `group` into runs that each lie within `SPAN` of their first
 * commit, oldest first.
 */
const splitBySpan = (
  group: ReadonlyArray<number>,
  candidates: ReadonlyArray<Candidate>,
): ReadonlyArray<ReadonlyArray<number>> => {
  const spans: Array<Array<number>> = [];
  let start = 0;
  for (const index of group.toSorted(
    (a, b) => timeOf(candidates, a) - timeOf(candidates, b),
  )) {
    const current = spans.at(-1);
    if (current === undefined || timeOf(candidates, index) - start > SPAN) {
      spans.push([index]);
      start = timeOf(candidates, index);
    } else {
      current.push(index);
    }
  }
  return spans;
};

/**
 * The commits that share a pull request, as sets of candidate indexes: those
 * with the same `(#123)` suffix within `SPAN` of the first, and those that one
 * pull request merge brought in.
 */
const pullRequests = (
  candidates: ReadonlyArray<Candidate>,
  merges: ReadonlyMap<string, string>,
): ReadonlyArray<ReadonlyArray<number>> =>
  [
    ...groupBy(candidates, ({ subject }) => pullRequestOf(subject)).flatMap(
      (group) => splitBySpan(group, candidates),
    ),
    ...groupBy(candidates, ({ sha, subject }) =>
      pullRequestOf(subject) === undefined ? merges.get(sha) : undefined,
    ),
  ].filter((group) => group.length <= MAX_GROUP_COMMITS);

/** The commits that mention one ticket within `SPAN` of its first, as sets of candidate indexes. */
const tickets = (
  candidates: ReadonlyArray<Candidate>,
): ReadonlyArray<ReadonlyArray<number>> =>
  groupBy(candidates, ({ subject }) => ticketOf(subject)).flatMap((group) =>
    splitBySpan(group, candidates),
  );

/** The distinct universe files a set of commits touched: the live ones, and how many with earlier lives. */
const touchedBy = (
  members: ReadonlyArray<number>,
  candidates: ReadonlyArray<Candidate>,
) => {
  const live = new Set<number>();
  const all = new Set<number>();
  for (const { files, previousLives } of members.flatMap(
    (index) => candidates[index] ?? [],
  )) {
    for (const id of files) {
      live.add(id);
      all.add(id);
    }
    for (const id of previousLives) {
      all.add(id);
    }
  }
  return { live, size: all.size };
};

const changeOf = (
  members: ReadonlyArray<number>,
  candidates: ReadonlyArray<Candidate>,
): LogicalChange => {
  const single =
    members.length === 1 ? candidates[members[0] ?? -1] : undefined;
  if (single !== undefined) {
    return { files: single.files, size: single.size };
  }
  const { live, size } = touchedBy(members, candidates);
  return { files: Uint32Array.from(live), size };
};

const byOf = (pullRequestGroups: boolean, ticketGroups: boolean): GroupedBy => {
  if (pullRequestGroups && ticketGroups) {
    return "mixed";
  }
  if (pullRequestGroups) {
    return "pr";
  }
  return ticketGroups ? "ticket" : "commit";
};

/** Whether commits that a ticket joins are small enough to be one change. */
const isOneChange = (
  members: ReadonlyArray<number>,
  candidates: ReadonlyArray<Candidate>,
): boolean =>
  members.length <= MAX_GROUP_COMMITS &&
  touchedBy(members, candidates).size <= MAX_COMMIT_FILES;

/** The sets of commits that make up one change each, and whether a ticket joined pull requests or commits into one. */
const settle = (
  candidates: ReadonlyArray<Candidate>,
  sharingPullRequest: ReadonlyArray<ReadonlyArray<number>>,
): ReadonlyArray<{
  readonly changes: ReadonlyArray<ReadonlyArray<number>>;
  readonly widened: boolean;
  readonly hasPullRequest: boolean;
}> => {
  const byPullRequest = new Partition(candidates.length);
  byPullRequest.joinAll(sharingPullRequest);
  const withTickets = new Partition(candidates.length);
  withTickets.joinAll(sharingPullRequest);
  withTickets.joinAll(tickets(candidates));
  const partsOf = new Map<number, Array<ReadonlyArray<number>>>();
  for (const part of byPullRequest.sets()) {
    const root = withTickets.rootOf(part[0] ?? 0);
    partsOf.set(root, [...(partsOf.get(root) ?? []), part]);
  }
  return withTickets.sets().map((wide) => {
    const parts = partsOf.get(withTickets.rootOf(wide[0] ?? 0)) ?? [];
    const widened = parts.length > 1 && isOneChange(wide, candidates);
    return {
      changes: widened ? [wide] : parts,
      widened,
      hasPullRequest: parts.some((part) => part.length > 1),
    };
  });
};

/**
 * Groups the commits of a window into logical changes. Commits belong
 * together when they share a pull request (the same `(#123)` suffix, or the
 * same merge commit that brought them in; see `readMerges`), and then when
 * they mention the same ticket key within 14 days of the first of them. A
 * pull request group of more than `MAX_GROUP_COMMITS` commits is dissolved,
 * and so is a ticket group that would join pull requests and commits into a
 * change of more than `MAX_COMMIT_FILES` files or `MAX_GROUP_COMMITS` commits:
 * its parts stay what they were. A change's files are the union of its
 * commits' files, and its size counts the files of their earlier lives too;
 * `candidates` list real commits only.
 */
export const groupChanges = (
  candidates: ReadonlyArray<Candidate>,
  merges: ReadonlyMap<string, string>,
): Grouping => {
  const settled = settle(candidates, pullRequests(candidates, merges));
  const sets = settled.flatMap(({ changes }) => changes);
  return {
    changes: sets.map((members) => changeOf(members, candidates)),
    by: byOf(
      settled.some(({ hasPullRequest }) => hasPullRequest),
      settled.some(({ widened }) => widened),
    ),
    largest: sets.reduce((most, members) => Math.max(most, members.length), 0),
  };
};
