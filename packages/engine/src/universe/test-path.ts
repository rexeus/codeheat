// Owns the answer to "is this path test code?": a test file by name, or any
// file below a test directory, and never a contract file.
import { isContractFile } from "./contract-files.js";

/** A test suffix at the end of a file's stem: `.test`, `.spec`, `_test`, `_spec`. */
const TEST_STEM = /[._](?:test|spec)$/u;

/**
 * Directories of test code: tests (`test`, `tests`, `__tests__`, `spec`,
 * `specs`, `e2e`), test inputs (`fixtures`, `__fixtures__`), and test support
 * (`testing`, `test-utils`, `test-helpers`, `__mocks__`, `mocks`,
 * `__snapshots__`).
 */
const TEST_DIRECTORY =
  /^(?:tests?|__tests__|specs?|e2e|fixtures|__fixtures__|testing|test-utils|test-helpers|__mocks__|mocks|__snapshots__)$/u;

/** The file name without its extension; a leading dot is no extension. */
const stemOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
};

/**
 * Whether a repository-relative path is test code: its file name has a test
 * suffix (`a.test.ts`, `a_spec.rb`) or one of its directories is named like a
 * test directory (see `TEST_DIRECTORY`). The file's own name is not a
 * directory: `src/test` as a file is no test.
 *
 * A contract file (`isContractFile`) is never test code: an interface
 * definition or schema lies in a `spec` or `specs` directory as a matter of
 * course (`spec/main.tsp`). This is the one owner of the rule: the universe
 * sets test code apart with it, and no design measure counts what it sets
 * apart.
 */
export const isTestPath = (path: string): boolean => {
  if (isContractFile(path)) {
    return false;
  }
  const parts = path.split("/");
  return (
    TEST_STEM.test(stemOf(parts.at(-1) ?? "")) ||
    parts.slice(0, -1).some((directory) => TEST_DIRECTORY.test(directory))
  );
};
