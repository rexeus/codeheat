// Owns which territory test code belongs to: the territory of the code it
// tests. A test that pairs with a source file follows it; a test below a test
// directory follows the code its directory sits beside; test code with no
// code beside it stays on its own.
import { testedStems } from "../coupling/pair.js";
import { isTestDirectoryName, isTestPath } from "../modules/test-path.js";

/** Where each test file goes. */
export type TestAttachment = {
  /** The files that shape the tree: every code file and the test code that belongs to no code. */
  readonly units: ReadonlyArray<string>;
  /** Test file to the code file it tests (a mirrored pair, see `isTestPair`). */
  readonly pairedWith: ReadonlyMap<string, string>;
  /** Test file to the directory whose code it belongs to. */
  readonly placedIn: ReadonlyMap<string, string>;
};

/** Directories the code of a test directory's parent may sit in, beside the test directory: Maven and Gradle keep `src/main` beside `src/test`. Only the placing of unpaired test code reads this, never `Coupling.testPair`. */
const SOURCE_ROOTS = ["src", "lib", "main"];

/** A JVM test class name: the class it tests, then `Test`, `Tests`, `IT`, or `Spec`. */
const JVM_TEST_NAME = /^(.+?)(?:Tests?|IT|Spec)$/u;

const stemOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") + 1 ? path.slice(0, dot) : path;
};

/**
 * The stem of the class a JVM test class tests in a Maven or Gradle layout: the
 * test lies below `src/test` and the class below `src/main`, at the same path
 * with the `Test`, `Tests`, `IT`, or `Spec` of the name left off. Nothing for
 * any other path.
 */
const jvmStems = (test: string): ReadonlyArray<string> => {
  const parts = stemOf(test).split("/");
  const tested = JVM_TEST_NAME.exec(parts.at(-1) ?? "")?.[1];
  const at = parts.findIndex(
    (part, index) => part === "src" && parts[index + 1] === "test",
  );
  return tested === undefined || at < 0
    ? []
    : [
        [
          ...parts.slice(0, at),
          "src",
          "main",
          ...parts.slice(at + 2, -1),
          tested,
        ].join("/"),
      ];
};

/** The stems of the sources a test may test: those of `testedStems` (a test suffix, a mirrored test directory), else those of a JVM test class. */
const stemsOf = (test: string): ReadonlyArray<string> => {
  const direct = testedStems(test);
  return direct.length > 0 ? direct : jvmStems(test);
};

const depthOf = (directory: string): number =>
  directory === "" ? 0 : directory.split("/").length;

const join = (...parts: ReadonlyArray<string>): string =>
  parts.filter((part) => part !== "").join("/");

/** Every directory that has a code file somewhere below it, the repository root ("") included. */
const directoriesWithCode = (
  sources: ReadonlyArray<string>,
): ReadonlySet<string> => {
  const directories = new Set<string>(sources.length > 0 ? [""] : []);
  for (const source of sources) {
    const parts = source.split("/").slice(0, -1);
    for (let length = 1; length <= parts.length; length += 1) {
      directories.add(parts.slice(0, length).join("/"));
    }
  }
  return directories;
};

/** The deepest of `directory` and its ancestors, not above `floor`, that has code below it. */
const deepestWithCode = (
  directory: string,
  floor: string,
  withCode: ReadonlySet<string>,
): string | undefined => {
  const parts = directory.split("/").filter((part) => part !== "");
  const floorDepth = floor === "" ? 0 : floor.split("/").length;
  for (let length = parts.length; length >= floorDepth; length -= 1) {
    const candidate = parts.slice(0, length).join("/");
    if (withCode.has(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

/**
 * The directory whose code an unpaired test belongs to. A test beside its code
 * (a test suffix, no test directory) belongs to its own directory. A test below
 * a test directory belongs to the code the directory sits beside: below `src`,
 * `lib`, or `main` next to it, else its parent, mirroring the path below the
 * test directory; the deepest of those that holds code. A top-level test directory with no `src` or `lib` beside it
 * belongs to no code, since the whole repository would be its home.
 */
const homeOf = (
  test: string,
  withCode: ReadonlySet<string>,
): string | undefined => {
  const parts = test.split("/");
  const directories = parts.slice(0, -1);
  const at = directories.findIndex((name) => isTestDirectoryName(name));
  if (at < 0) {
    const own = directories.join("/");
    return own === "" ? undefined : deepestWithCode(own, own, withCode);
  }
  const parent = directories.slice(0, at).join("/");
  const mirrored = directories.slice(at + 1);
  const candidates = [
    ...SOURCE_ROOTS.map((root) => join(parent, root, ...mirrored)),
    ...(parent === "" ? [] : [join(parent, ...mirrored)]),
  ];
  const homes = candidates
    .flatMap((candidate) => deepestWithCode(candidate, parent, withCode) ?? [])
    .filter((home) => home !== "" || parent !== "");
  return homes.toSorted((a, b) => depthOf(b) - depthOf(a))[0];
};

/**
 * Sorts `paths` (the code files of the universe) into code, tests that pair
 * with code (`pairedWith`), tests that belong to a directory's code
 * (`placedIn`), and test code that belongs to none, which stays a unit of its
 * own.
 */
export const attachTests = (paths: ReadonlyArray<string>): TestAttachment => {
  const sources = paths.filter((path) => !isTestPath(path));
  const bySourceStem = new Map<string, string>();
  for (const source of sources) {
    const stem = stemOf(source);
    if (!bySourceStem.has(stem)) {
      bySourceStem.set(stem, source);
    }
  }
  const withCode = directoriesWithCode(sources);
  const units = [...sources];
  const pairedWith = new Map<string, string>();
  const placedIn = new Map<string, string>();
  for (const test of paths.filter((path) => isTestPath(path))) {
    const source = stemsOf(test)
      .map((stem) => bySourceStem.get(stem))
      .find((found) => found !== undefined);
    const home = source === undefined ? homeOf(test, withCode) : undefined;
    if (source !== undefined) {
      pairedWith.set(test, source);
    } else if (home === undefined) {
      units.push(test);
    } else {
      placedIn.set(test, home);
    }
  }
  return { units: units.toSorted(), pairedWith, placedIn };
};
