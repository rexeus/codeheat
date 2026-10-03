// Owns finding the parts of a group of modules that changes really touched as
// a whole: what remains of a clique when no change touched all of its members.

/** Intersections kept while searching; bounds the work for a group that many different changes touch in different parts. */
const MAX_CANDIDATES = 500;

/** Distinct parts of a group that changes touched, kept while searching; bounds the work of counting their support. */
const MAX_PARTS = 1000;

type Part = { members: ReadonlyArray<string>; commits: number };

const keyOf = (members: ReadonlyArray<string>): string => members.join("\n");

const isWithin = (
  part: ReadonlyArray<string>,
  whole: ReadonlyArray<string>,
): boolean => part.every((member) => whole.includes(member));

const intersect = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): ReadonlyArray<string> => a.filter((member) => b.includes(member));

/**
 * The parts of `group` that each change touched, with at least `minSize`
 * members, and how many changes touched exactly that part; `partial` when
 * more than `MAX_PARTS` distinct parts exist and the rest was left out.
 */
const touchedParts = (
  group: ReadonlyArray<string>,
  touched: ReadonlyArray<ReadonlySet<string>>,
  minSize: number,
): { parts: ReadonlyMap<string, Part>; partial: boolean } => {
  const parts = new Map<string, Part>();
  let partial = false;
  for (const commit of touched) {
    const members = group.filter((module) => commit.has(module));
    const key = keyOf(members);
    const known = parts.get(key);
    if (members.length < minSize) {
      continue;
    }
    if (known === undefined && parts.size >= MAX_PARTS) {
      partial = true;
    } else {
      parts.set(key, { members, commits: (known?.commits ?? 0) + 1 });
    }
  }
  return { parts, partial };
};

/**
 * What `fresh` has in common with the candidates, where that is at least
 * `minSize` members and not a candidate yet, stopping once `room` new ones
 * are found; `full` says it stopped for that reason.
 */
const newIntersections = (
  fresh: ReadonlyArray<string>,
  candidates: ReadonlyMap<string, ReadonlyArray<string>>,
  minSize: number,
  room: number,
): { found: ReadonlyArray<ReadonlyArray<string>>; full: boolean } => {
  const found = new Map<string, ReadonlyArray<string>>();
  for (const other of candidates.values()) {
    const common = intersect(fresh, other);
    if (common.length >= minSize && !candidates.has(keyOf(common))) {
      found.set(keyOf(common), common);
    }
    if (found.size >= room) {
      return { found: [...found.values()], full: true };
    }
  }
  return { found: [...found.values()], full: false };
};

/**
 * Adds the intersections of the parts with each other, and of those, until no
 * new one with `minSize` members appears or `MAX_CANDIDATES` are held, in
 * which case `partial` is set.
 */
const withIntersections = (
  parts: ReadonlyMap<string, Part>,
  minSize: number,
): { candidates: ReadonlyArray<ReadonlyArray<string>>; partial: boolean } => {
  const candidates = new Map<string, ReadonlyArray<string>>(
    [...parts].map(([key, { members }]) => [key, members]),
  );
  let frontier = [...candidates.values()];
  let partial = candidates.size > MAX_CANDIDATES;
  while (frontier.length > 0 && !partial) {
    const added: Array<ReadonlyArray<string>> = [];
    for (const fresh of frontier) {
      const room = MAX_CANDIDATES - candidates.size;
      const { found, full } = newIntersections(
        fresh,
        candidates,
        minSize,
        room,
      );
      for (const common of found) {
        candidates.set(keyOf(common), common);
        added.push(common);
      }
      partial = partial || full || candidates.size >= MAX_CANDIDATES;
      if (partial) {
        break;
      }
    }
    frontier = added;
  }
  return { candidates: [...candidates.values()], partial };
};

/**
 * The maximal parts of `group` (module paths, sorted) with at least `minSize`
 * members that at least `minCommits` of the `touched` commits (the modules
 * each touched) touched in full. A part is found as the modules several
 * changes have in common within the group, so a group whose members never met
 * all at once still yields the sub-groups that did.
 *
 * The search is bounded (at most 1000 distinct parts and 500 intersections);
 * `partial` says a bound was hit and a sub-group may be missing.
 */
export const supportedSubgroups = (
  group: ReadonlyArray<string>,
  touched: ReadonlyArray<ReadonlySet<string>>,
  minSize: number,
  minCommits: number,
): { groups: ReadonlyArray<ReadonlyArray<string>>; partial: boolean } => {
  const { parts, partial: partsPartial } = touchedParts(
    group,
    touched,
    minSize,
  );
  const { candidates, partial: candidatesPartial } = withIntersections(
    parts,
    minSize,
  );
  const supported = candidates.filter(
    (candidate) =>
      [...parts.values()]
        .filter(({ members }) => isWithin(candidate, members))
        .reduce((total, { commits }) => total + commits, 0) >= minCommits,
  );
  return {
    groups: supported.filter(
      (candidate) =>
        !supported.some(
          (other) =>
            other.length > candidate.length && isWithin(candidate, other),
        ),
    ),
    partial: partsPartial || candidatesPartial,
  };
};
