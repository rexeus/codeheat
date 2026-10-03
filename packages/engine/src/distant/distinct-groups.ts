// Owns telling distinct groups of modules from variants of one: two cliques
// that come from one unit of change and overlap almost entirely describe it
// twice.
import { Order } from "effect";

type Group = {
  readonly modules: ReadonlyArray<string>;
  /** Counted commits that touched every member. */
  readonly sharedCommits: number;
};

/** Whether two modules are linked in the module pair graph (see `linkedModules`). */
export type IsLinked = (a: string, b: string) => boolean;

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

/** Every pair of the members of `a` and `b` together is linked. */
const isOneUnit = (a: Group, b: Group, isLinked: IsLinked): boolean => {
  const union = [...new Set([...a.modules, ...b.modules])];
  return union.every((first, index) =>
    union.slice(index + 1).every((second) => isLinked(first, second)),
  );
};

/** How many members of the larger group two variants must share: all but one, or four fifths of it, whichever is fewer. */
const requiredOverlap = (larger: number): number =>
  Math.min(larger - 1, Math.ceil(0.8 * larger));

const areVariants = (a: Group, b: Group, isLinked: IsLinked): boolean =>
  commonMembers(a, b) >=
    requiredOverlap(Math.max(a.modules.length, b.modules.length)) &&
  isOneUnit(a, b, isLinked);

/**
 * The distinct groups among `groups` (each with at least three sorted
 * members). A group inside another is dropped. Two groups are variants of one
 * unit of change when their union is pairwise linked in the module pair graph
 * (`isLinked`) and they share at least `min(n − 1, ceil(0.8 n))` members, `n`
 * being the size of the larger; of variants only the stronger stays (more
 * commits touching all members, then more members, then path), judged against
 * the groups already kept, strongest first. Groups that fail either test are
 * different units and all stay: members that never change together, or little
 * overlap.
 */
export const distinctGroups = <Item extends Group>(
  groups: ReadonlyArray<Item>,
  isLinked: IsLinked,
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
    if (!kept.some((stronger) => areVariants(group, stronger, isLinked))) {
      kept.push(group);
    }
  }
  return kept;
};
