// Owns finding the parts of a group of modules that commits really touched as
// a whole: what remains of a clique when no commit touched all of its members.

/** Intersections kept while searching; a guard for a group that many different commits touch in different parts. */
const MAX_CANDIDATES = 500;

const keyOf = (members: ReadonlyArray<string>): string => members.join("\n");

const isWithin = (
  part: ReadonlyArray<string>,
  whole: ReadonlyArray<string>,
): boolean => part.every((member) => whole.includes(member));

const intersect = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): ReadonlyArray<string> => a.filter((member) => b.includes(member));

/** The parts of `group` that each commit touched, with at least `minSize` members, and how many commits touched exactly that part. */
const touchedParts = (
  group: ReadonlyArray<string>,
  touched: ReadonlyArray<ReadonlySet<string>>,
  minSize: number,
): ReadonlyMap<string, { members: ReadonlyArray<string>; commits: number }> => {
  const parts = new Map<
    string,
    { members: ReadonlyArray<string>; commits: number }
  >();
  for (const commit of touched) {
    const members = group.filter((module) => commit.has(module));
    if (members.length >= minSize) {
      const known = parts.get(keyOf(members));
      parts.set(keyOf(members), {
        members,
        commits: (known?.commits ?? 0) + 1,
      });
    }
  }
  return parts;
};

/** What `fresh` has in common with each of `others`, where that is at least `minSize` members. */
const commonParts = (
  fresh: ReadonlyArray<string>,
  others: Iterable<ReadonlyArray<string>>,
  minSize: number,
): ReadonlyArray<ReadonlyArray<string>> =>
  Array.from(others, (other) => intersect(fresh, other)).filter(
    (common) => common.length >= minSize,
  );

/** Adds the intersections of the parts with each other, and of those, until no new one with `minSize` members appears. */
const withIntersections = (
  parts: ReadonlyMap<string, { members: ReadonlyArray<string> }>,
  minSize: number,
): ReadonlyArray<ReadonlyArray<string>> => {
  const candidates = new Map<string, ReadonlyArray<string>>(
    [...parts].map(([key, { members }]) => [key, members]),
  );
  let frontier = [...candidates.values()];
  while (frontier.length > 0 && candidates.size < MAX_CANDIDATES) {
    const added: Array<ReadonlyArray<string>> = [];
    const found = frontier.flatMap((fresh) =>
      commonParts(fresh, candidates.values(), minSize),
    );
    for (const common of found) {
      if (!candidates.has(keyOf(common))) {
        candidates.set(keyOf(common), common);
        added.push(common);
      }
    }
    frontier = added;
  }
  return [...candidates.values()];
};

/**
 * The maximal parts of `group` (module paths, sorted) with at least `minSize`
 * members that at least `minCommits` of the `touched` commits (the modules
 * each touched) touched in full. A part is found as the modules several
 * commits have in common within the group, so a group whose members never met
 * all at once still yields the sub-groups that did.
 */
export const supportedSubgroups = (
  group: ReadonlyArray<string>,
  touched: ReadonlyArray<ReadonlySet<string>>,
  minSize: number,
  minCommits: number,
): ReadonlyArray<ReadonlyArray<string>> => {
  const parts = touchedParts(group, touched, minSize);
  const supported = withIntersections(parts, minSize).filter(
    (candidate) =>
      [...parts.values()]
        .filter(({ members }) => isWithin(candidate, members))
        .reduce((total, { commits }) => total + commits, 0) >= minCommits,
  );
  return supported.filter(
    (candidate) =>
      !supported.some(
        (other) =>
          other.length > candidate.length && isWithin(candidate, other),
      ),
  );
};
