// Owns the path-only facts about coupled pairs: how far apart a pair is.

const directoriesOf = (path: string): ReadonlyArray<string> =>
  path.split("/").slice(0, -1);

/**
 * Directory hops between the parent directories of two repository-relative
 * paths: 0 in the same directory, 1 for parent and child, 2 for siblings.
 */
export const directoryDistance = (a: string, b: string): number => {
  const from = directoriesOf(a);
  const to = directoriesOf(b);
  let shared = 0;
  while (shared < from.length && from[shared] === to[shared]) {
    shared += 1;
  }
  return from.length - shared + (to.length - shared);
};
