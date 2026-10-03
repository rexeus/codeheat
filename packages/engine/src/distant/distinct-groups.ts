// Owns telling distinct groups of modules from variants of one: two cliques
// that differ by a single member describe one unit of change, not two.
import { Order } from "effect";

type Group = {
  readonly modules: ReadonlyArray<string>;
  /** Counted commits that touched every member. */
  readonly sharedCommits: number;
};

const isWithin = (
  part: ReadonlyArray<string>,
  whole: ReadonlyArray<string>,
): boolean => part.every((member) => whole.includes(member));

const commonMembers = (a: Group, b: Group): number =>
  a.modules.filter((member) => b.modules.includes(member)).length;

/** The group whose members changed together in more commits, then the larger, then by path. */
const strongestFirst = (a: Group, b: Group): number =>
  b.sharedCommits - a.sharedCommits ||
  b.modules.length - a.modules.length ||
  Order.String(a.modules.join("\n"), b.modules.join("\n"));

/**
 * The distinct groups among `groups` (each with at least three sorted members):
 * a group inside another is dropped, and of two groups that share all but one
 * member only the stronger stays (more commits touching all members, then more
 * members, then path), judged against the groups already kept, strongest
 * first. Two groups with fewer members in common are different units of change
 * and both stay.
 */
export const distinctGroups = <Item extends Group>(
  groups: ReadonlyArray<Item>,
): ReadonlyArray<Item> => {
  const maximal = groups.filter(
    (group) =>
      !groups.some(
        (other) =>
          other.modules.length > group.modules.length &&
          isWithin(group.modules, other.modules),
      ),
  );
  const kept: Array<Item> = [];
  for (const group of maximal.toSorted(strongestFirst)) {
    const isVariant = kept.some(
      (stronger) =>
        commonMembers(group, stronger) >=
        Math.max(group.modules.length, stronger.modules.length) - 1,
    );
    if (!isVariant) {
      kept.push(group);
    }
  }
  return kept;
};
