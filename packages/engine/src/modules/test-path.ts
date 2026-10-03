// Owns the answer to "is this path a test?": a test file by name, or any file
// below a test directory, and never a contract file.
import {
  FIXTURE_DIRECTORIES,
  isTestFile,
  MIRRORED_TEST_DIRECTORIES,
} from "../coupling/pair.js";
import { isContractFile } from "../universe/contract-files.js";

/** Directories of test support: utilities, helpers, mocks, and snapshots that exist for tests and pair with no source file. */
const SUPPORT_DIRECTORIES: ReadonlySet<string> = new Set([
  "testing",
  "test-utils",
  "test-helpers",
  "__mocks__",
  "mocks",
  "__snapshots__",
]);

const TEST_DIRECTORY_NAMES = new Set([
  ...MIRRORED_TEST_DIRECTORIES,
  ...FIXTURE_DIRECTORIES,
  ...SUPPORT_DIRECTORIES,
]);

/** Whether a directory name is one of the test directories `isTestPath` knows. */
export const isTestDirectoryName = (name: string): boolean =>
  TEST_DIRECTORY_NAMES.has(name);

/**
 * Whether a repository-relative path is test code: its file name has a test
 * suffix (`isTestFile`) or one of its directories is named like a test
 * directory (`test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`,
 * `__fixtures__`, or test support: `testing`, `test-utils`, `test-helpers`,
 * `__mocks__`, `mocks`, `__snapshots__`). The file's own name is not a directory: `src/test` as a
 * file is no test.
 *
 * A contract file (`isContractFile`) is never test code: an interface
 * definition or schema lies in a `spec` or `specs` directory as a matter of
 * course (`spec/main.tsp`), and a test-code rule must not drop it from the
 * measures that leave tests out. This is the one owner of the rule; every
 * measure that asks whether a file is test code asks here.
 */
export const isTestPath = (path: string): boolean =>
  !isContractFile(path) &&
  (isTestFile(path) ||
    path
      .split("/")
      .slice(0, -1)
      .some((directory) => isTestDirectoryName(directory)));
