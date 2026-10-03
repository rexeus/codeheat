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

/** Directories a mirrored test directory stands in for, beside it. */
const SOURCE_ROOTS = ["src", "lib"];

const stemOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") + 1 ? path.slice(0, dot) : path;
};

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
 * a test directory belongs to the code the directory sits beside: below `src`
 * or `lib` next to it, else its parent, mirroring the path below the test
 * directory. A top-level test directory with no `src` or `lib` beside it
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
  for (const candidate of candidates) {
    const home = deepestWithCode(candidate, parent, withCode);
    if (home !== undefined && (home !== "" || parent !== "")) {
      return home;
    }
  }
  return undefined;
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
    const source = testedStems(test)
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
