// Owns attributing commits to the pull request merge that brought them in,
// from the parent links of a window's commits.

/** The parents of every commit of a window, by commit id, first parent first. */
export type Graph = ReadonlyMap<string, ReadonlyArray<string>>;

/** A branch tip to visit and the owner of its commits; none when the merge that brought it in is no pull request. */
type Branch = readonly [commit: string, owner: string | undefined];

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
 * first. Each is its own owner (an octopus merge joins unrelated topics), and
 * none when the merge is no pull request.
 */
const mergedBranches = (
  graph: Graph,
  commit: string,
  isPullRequest: boolean,
): ReadonlyArray<Branch> =>
  (graph.get(commit) ?? [])
    .slice(1)
    .map((parent, index) => [
      parent,
      isPullRequest ? `${commit}/${index + 1}` : undefined,
    ]);

/**
 * The branches to visit after `commit`, which belongs to `owner`: its first
 * parent continues the same branch, the others are branches it merged.
 */
const branchesAfter = (
  graph: Graph,
  commit: string,
  owner: string | undefined,
  pullRequests: ReadonlySet<string>,
): ReadonlyArray<Branch> => {
  const first = graph.get(commit)?.[0];
  return [
    ...(first === undefined ? [] : [[first, owner] as const]),
    ...mergedBranches(graph, commit, pullRequests.has(commit)),
  ];
};

/**
 * Maps each commit that is not on the first-parent line of `tip` to the pull
 * request merge that brought it in: the merge in `pullRequests` whose second
 * (or later) parent leads to it along first parents, up to the line it
 * branched from. Commits on the first-parent line, commits whose branch lies
 * outside the graph, and commits that only another kind of merge brought in
 * (`git pull`, a merge of the mainline into a branch, a tag) have no entry:
 * such a merge groups nothing, but the pull requests merged inside its
 * branches still do. A branch merged into another branch belongs to that
 * inner merge, so a long-lived branch merged into the mainline later does not
 * swallow the branches merged into it. The oldest merge on the line claims a
 * commit that several merges reach.
 */
export const mergesOf = (
  graph: Graph,
  tip: string,
  pullRequests: ReadonlySet<string>,
): ReadonlyMap<string, string> => {
  const line = firstParentLine(graph, tip);
  const onLine = new Set(line);
  const seen = new Set<string>();
  const mergeOf = new Map<string, string>();
  for (const merge of line.toReversed()) {
    // Each entry is a branch tip and its owner; visited commits add their parents.
    const open = [...mergedBranches(graph, merge, pullRequests.has(merge))];
    for (const [commit, owner] of open) {
      if (onLine.has(commit) || seen.has(commit) || !graph.has(commit)) {
        continue;
      }
      seen.add(commit);
      if (owner !== undefined) {
        mergeOf.set(commit, owner);
      }
      open.push(...branchesAfter(graph, commit, owner, pullRequests));
    }
  }
  return mergeOf;
};
