// Owns attributing commits to the merge commit that brought them in, from the
// parent links of a window's commits.

/** The parents of every commit of a window, by commit id, first parent first. */
export type Graph = ReadonlyMap<string, ReadonlyArray<string>>;

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
 * The commits to visit after `commit`, which belongs to `owner`: its first
 * parent continues the same branch, any other parent is a branch merged into
 * it and belongs to `commit` itself.
 */
const branchesOf = (
  graph: Graph,
  commit: string,
  owner: string,
): ReadonlyArray<readonly [string, string]> =>
  (graph.get(commit) ?? []).map((parent, index) => [
    parent,
    index === 0 ? owner : commit,
  ]);

/**
 * Maps each commit that is not on the first-parent line of `tip` to the merge
 * commit that brought it in: the merge whose second (or later) parent leads to
 * it along first parents, up to the line it branched from. Commits on the
 * first-parent line, and commits whose branch lies outside the graph, have no
 * entry. A branch merged into another branch belongs to that inner merge, so
 * a long-lived branch merged into the mainline later does not swallow the
 * branches merged into it. The oldest merge on the line claims a commit that
 * several merges reach.
 */
export const mergesOf = (
  graph: Graph,
  tip: string,
): ReadonlyMap<string, string> => {
  const line = firstParentLine(graph, tip);
  const onLine = new Set(line);
  const mergeOf = new Map<string, string>();
  for (const merge of line.toReversed()) {
    // Each entry is a branch tip and the merge it belongs to; claimed commits add their parents.
    const open = branchesOf(graph, merge, merge).slice(1);
    for (const [commit, owner] of open) {
      if (onLine.has(commit) || mergeOf.has(commit) || !graph.has(commit)) {
        continue;
      }
      mergeOf.set(commit, owner);
      open.push(...branchesOf(graph, commit, owner));
    }
  }
  return mergeOf;
};
