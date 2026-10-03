// Owns which sibling folders stay together: those whose changes are largely
// the same changes, so that one is not understood without the other.

/** Of two siblings, the share of their changes that are the same ones must reach this (Jaccard). */
const TOGETHER_JACCARD = 0.4;
/** And they must share at least this many changes. */
const TOGETHER_MIN_SHARED = 5;
/** A group holds at most this many folders. */
const MAX_GROUP_FOLDERS = 3;

/** How many changes touched each sibling, and each pair of them. */
export type Tally = {
  readonly per: ReadonlyMap<string, number>;
  /** Changes that touched both siblings, by `pairKey`. */
  readonly pair: ReadonlyMap<string, number>;
};

/** The key of an unordered pair of siblings. */
export const pairKey = (x: string, y: string): string =>
  x < y ? `${x}\0${y}` : `${y}\0${x}`;

/** Two siblings' shared changes and their share of all the changes either one had. */
type Link = { readonly shared: number; readonly jaccard: number };

const linkOf = ({ per, pair }: Tally, x: string, y: string): Link => {
  const shared = pair.get(pairKey(x, y)) ?? 0;
  const either = (per.get(x) ?? 0) + (per.get(y) ?? 0) - shared;
  return { shared, jaccard: either === 0 ? 0 : shared / either };
};

const holds = ({ shared, jaccard }: Link): boolean =>
  jaccard >= TOGETHER_JACCARD && shared >= TOGETHER_MIN_SHARED;

/** One group of siblings that stay together, and the first pair that brought it together. */
export type Together = {
  readonly folders: ReadonlyArray<string>;
  readonly link: Link;
};

/** The pairs of `siblings` that change together, strongest first. */
const strongPairs = (
  siblings: ReadonlyArray<string>,
  tally: Tally,
): ReadonlyArray<{ x: string; y: string; link: Link }> => {
  const known = new Set(siblings);
  return [...tally.pair.keys()]
    .map((key) => key.split("\0"))
    .flatMap(([x, y]) => (x === undefined || y === undefined ? [] : [{ x, y }]))
    .filter(({ x, y }) => known.has(x) && known.has(y))
    .map(({ x, y }) => ({ x, y, link: linkOf(tally, x, y) }))
    .filter(({ link }) => holds(link))
    .toSorted((a, b) => b.link.jaccard - a.link.jaccard);
};

/** The two groups as one, when it stays small and every folder of one holds with every folder of the other. */
const merged = (
  left: Together,
  right: Together,
  link: Link,
  tally: Tally,
): Together | undefined => {
  const folders = [...left.folders, ...right.folders];
  const complete = left.folders.every((u) =>
    right.folders.every((v) => holds(linkOf(tally, u, v))),
  );
  return folders.length > MAX_GROUP_FOLDERS || !complete
    ? undefined
    : { folders, link: left.folders.length > 1 ? left.link : link };
};

/**
 * Groups `siblings` whose changes overlap: complete linkage on the Jaccard
 * index of their changes, strongest pair first, so every two folders of a
 * group hold (`TOGETHER_JACCARD`, `TOGETHER_MIN_SHARED`). A group has at most
 * three folders. Every sibling is in exactly one group, most alone.
 */
export const keepTogether = (
  siblings: ReadonlyArray<string>,
  tally: Tally,
): ReadonlyArray<Together> => {
  const groupOf = new Map<string, Together>(
    siblings.map((folder) => [
      folder,
      { folders: [folder], link: { shared: 0, jaccard: 0 } },
    ]),
  );
  for (const { x, y, link } of strongPairs(siblings, tally)) {
    const left = groupOf.get(x);
    const right = groupOf.get(y);
    const together =
      left === undefined || right === undefined || left === right
        ? undefined
        : merged(left, right, link, tally);
    if (together !== undefined) {
      for (const folder of together.folders) {
        groupOf.set(folder, together);
      }
    }
  }
  return [...new Set(groupOf.values())];
};
