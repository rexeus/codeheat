// Owns the path-only facts about files and coupled pairs: how far apart a pair
// is and whether a file is a test or one file is the other's test.

const TEST_SUFFIXES = [".test", ".spec", "_test"];

const directoriesOf = (path: string): ReadonlyArray<string> =>
  path.split("/").slice(0, -1);

/** The path without its extension; a leading dot in the file name is not an extension. */
const stemOf = (path: string): string => {
  const extensionStart = path.lastIndexOf(".");
  return extensionStart > path.lastIndexOf("/") + 1
    ? path.slice(0, extensionStart)
    : path;
};

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

/** The stem ends in `.test`, `.spec`, or `_test`. */
export const isTestFile = (path: string): boolean => {
  const stem = stemOf(path);
  return TEST_SUFFIXES.some((suffix) => stem.endsWith(suffix));
};

/** One path's stem equals the other's stem plus `.test`, `.spec`, or `_test`. */
export const isTestPair = (a: string, b: string): boolean => {
  const stemA = stemOf(a);
  const stemB = stemOf(b);
  return TEST_SUFFIXES.some(
    (suffix) => stemA + suffix === stemB || stemB + suffix === stemA,
  );
};
