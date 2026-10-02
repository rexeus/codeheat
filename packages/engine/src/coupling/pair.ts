// Owns the path-only facts about files and coupled pairs: how far apart a pair
// is and whether a file is a test or one file is the other's test.

const TEST_SUFFIXES = [".test", ".spec", "_test", "_spec"];

/**
 * Directories whose files mirror the source tree beside them (`test/a/b.test.ts`
 * tests `src/a/b.ts`). Fixtures are test code too, but mirror nothing.
 */
export const MIRRORED_TEST_DIRECTORIES: ReadonlySet<string> = new Set([
  "test",
  "tests",
  "__tests__",
  "spec",
  "specs",
  "e2e",
]);

/** What a mirrored test directory stands in for: a source root beside it, or (undefined) the directory it sits in. */
const SOURCE_ROOTS = ["src", "lib", undefined] as const;

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

/** The stem without its test suffix; undefined when it has none or nothing else. */
const withoutTestSuffix = (stem: string): string | undefined => {
  const suffix = TEST_SUFFIXES.find((candidate) => stem.endsWith(candidate));
  const name = suffix === undefined ? "" : stem.slice(0, -suffix.length);
  return name === "" || name.endsWith("/") ? undefined : name;
};

/** One path's stem equals the other's stem plus a test suffix. */
const isSideBySide = (a: string, b: string): boolean => {
  const stemA = stemOf(a);
  const stemB = stemOf(b);
  return TEST_SUFFIXES.some(
    (suffix) => stemA + suffix === stemB || stemB + suffix === stemA,
  );
};

/**
 * `test` has a test suffix and lies below a mirrored test directory, and
 * `source` is where that directory's mirror puts the same stem: the directory
 * removed, or replaced by `src` or `lib`.
 */
const mirrors = (test: string, source: string): boolean => {
  const name = withoutTestSuffix(stemOf(test));
  if (name === undefined) {
    return false;
  }
  const parts = name.split("/");
  const sourceStem = stemOf(source);
  return parts.some(
    (part, index) =>
      index < parts.length - 1 &&
      MIRRORED_TEST_DIRECTORIES.has(part) &&
      SOURCE_ROOTS.some(
        (root) =>
          [
            ...parts.slice(0, index),
            ...(root === undefined ? [] : [root]),
            ...parts.slice(index + 1),
          ].join("/") === sourceStem,
      ),
  );
};

/**
 * One path is the other's test: both lie in one directory and one stem is the
 * other's plus `.test`, `.spec`, `_test`, or `_spec`; or the test lies below a
 * mirrored test directory (`test`, `tests`, `__tests__`, `spec`, `specs`,
 * `e2e`) and the source is at the same path with that directory removed or
 * replaced by `src` or `lib`: `src/a/b.ts` and `test/a/b.test.ts`, `lib/x.ts`
 * and `__tests__/x.test.ts`, `p/y.ts` and `p/tests/y.test.ts`. The test needs
 * a suffix: helpers, steps, mocks, and fixtures pair with nothing.
 */
export const isTestPair = (a: string, b: string): boolean =>
  isSideBySide(a, b) || mirrors(a, b) || mirrors(b, a);
