// Owns the answer to "is this path a test?" for module measures: a test file
// by name, or any file below a test directory.
import {
  FIXTURE_DIRECTORIES,
  isTestFile,
  MIRRORED_TEST_DIRECTORIES,
} from "../coupling/pair.js";

const TEST_DIRECTORY_NAMES = new Set([
  ...MIRRORED_TEST_DIRECTORIES,
  ...FIXTURE_DIRECTORIES,
]);

/**
 * Whether a repository-relative path is test code: its file name has a test
 * suffix (`isTestFile`) or one of its directories is named like a test
 * directory (`test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`,
 * `__fixtures__`). The file's own name is not a directory: `src/test` as a
 * file is no test.
 */
export const isTestPath = (path: string): boolean =>
  isTestFile(path) ||
  path
    .split("/")
    .slice(0, -1)
    .some((directory) => TEST_DIRECTORY_NAMES.has(directory));
