// Owns attributing commits to the pull request merge that brought them in,
// from the parent links of a window's commits.

/** The parents of every commit of a window, by commit id, first parent first. */
export type Graph = ReadonlyMap<string, ReadonlyArray<string>>;

/**
 * The pull request merges among a window's merge commits. A merge of an
 * `integration` branch (a release or `develop` branch, as its message names it)
 * brings in work that is no one change.
 */
export type PullRequestMerges = ReadonlyMap<string, "branch" | "integration">;

/** A branch tip, the owner of its direct commits, and whether it is an integration branch. */
type Branch = {
  readonly tip: string;
  readonly owner: string | undefined;
  readonly integration: boolean;
};

/** The commits on the first-parent line from `tip`, newest first. */
const firstParentLine = (graph: Graph, tip: string): ReadonlyArray<string> => {
  const line = new Set<string>();
  for (
    let commit: string | undefined = tip;
    commit !== undefined && !line.has(commit);
    commit = graph.get(commit)?.[0]
  ) {
    line.add(commit);
  }
  return [...line];
};

/**
 * The branches that merge `commit` brought in, one per parent after the
 * first. Each is its own owner for a pull request merge (an octopus merge
 * joins unrelated topics). Any other merge, such as a `git pull` inside a
 * pull request's branch, keeps the `enclosing` owner of the branch it is on.
 */
const mergedBranches = (
  graph: Graph,
  commit: string,
  kind: "branch" | "integration" | undefined,
  enclosing: string | undefined,
): ReadonlyArray<Branch> =>
  (graph.get(commit) ?? []).slice(1).map((tip, index) => ({
    tip,
    owner: kind === undefined ? enclosing : `${commit}/${index + 1}`,
    integration: kind === "integration",
  }));

/**
 * The commits of `branch` along first parents, newest first, up to the
 * mainline, a commit that is already claimed, or the edge of the graph.
 */
const directCommits = (
  graph: Graph,
  { tip }: Branch,
  onLine: ReadonlySet<string>,
  seen: ReadonlySet<string>,
): ReadonlyArray<string> => {
  const commits: Array<string> = [];
  for (
    let commit: string | undefined = tip;
    commit !== undefined &&
    graph.has(commit) &&
    !onLine.has(commit) &&
    !seen.has(commit);
    commit = graph.get(commit)?.[0]
  ) {
    commits.push(commit);
  }
  return commits;
};

/** What a walk has learned: the mainline, the commits claimed so far, and who owns them. */
type Walk = {
  readonly graph: Graph;
  readonly onLine: ReadonlySet<string>;
  readonly seen: Set<string>;
  readonly mergeOf: Map<string, string>;
  readonly pullRequests: PullRequestMerges;
  readonly squashed: ReadonlySet<string>;
};

/**
 * Claims the direct commits of `branch` for its owner, none when it is an
 * integration branch, and returns the branches merged along them, oldest
 * merge first.
 */
const claim = (walk: Walk, branch: Branch): ReadonlyArray<Branch> => {
  const { graph, pullRequests, squashed, seen, mergeOf } = walk;
  const commits = directCommits(graph, branch, walk.onLine, seen);
  const isIntegration =
    branch.integration ||
    commits.some((commit) => pullRequests.has(commit) || squashed.has(commit));
  const owner = isIntegration ? undefined : branch.owner;
  for (const commit of commits) {
    seen.add(commit);
    if (owner !== undefined) {
      mergeOf.set(commit, owner);
    }
  }
  return commits
    .toReversed()
    .flatMap((commit) =>
      mergedBranches(graph, commit, pullRequests.get(commit), owner),
    );
};

/**
 * Maps each commit that is not on the first-parent line of `tip` to the pull
 * request merge that brought it in: the merge in `pullRequests` whose second
 * (or later) parent leads to it along first parents, up to the line it
 * branched from. Commits on the first-parent line, commits whose branch lies
 * outside the graph, and commits that only another kind of merge brought in
 * (`git pull`, a merge of the mainline into a branch, a tag) have no entry:
 * such a merge groups nothing, but the pull requests merged inside its
 * branches still do.
 *
 * A branch is claimed whole along its first parents before the branches merged
 * into it, which are claimed oldest merge first, level by level: a pull request
 * merged into a long-lived branch cannot take the commits that branch had
 * before its fork point, and a branch merged into another branch belongs to
 * that inner merge. The direct commits of an integration branch, one that a
 * pull request merge names as a release or `develop` branch or whose line
 * itself contains pull request merges or `squashed` pull requests (commits
 * that a squash merge made), belong to no change. Another kind of merge on a
 * pull request's branch, such as a `git pull`, brings in commits of the same
 * pull request.
 */
export const mergesOf = (
  graph: Graph,
  tip: string,
  pullRequests: PullRequestMerges,
  squashed: ReadonlySet<string>,
): ReadonlyMap<string, string> => {
  const line = firstParentLine(graph, tip);
  const walk: Walk = {
    graph,
    onLine: new Set(line),
    seen: new Set(),
    mergeOf: new Map(),
    pullRequests,
    squashed,
  };
  for (const merge of line.toReversed()) {
    let level = mergedBranches(
      graph,
      merge,
      pullRequests.get(merge),
      undefined,
    );
    while (level.length > 0) {
      level = level.flatMap((branch) => claim(walk, branch));
    }
  }
  return walk.mergeOf;
};
