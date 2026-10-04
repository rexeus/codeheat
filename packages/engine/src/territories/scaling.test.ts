import { describe, expect, it } from "vitest";

import { isTestPath } from "../modules/test-path.js";
import { buildTerritories } from "./build-territories.js";

const file = (path: string) => ({
  path,
  loc: 10,
  complexity: { total: 5 },
  changes: 2,
  test: isTestPath(path),
});

/**
 * `count` sibling modules, each with three code files and one unpaired test
 * that is placed beside them: every module has a home for test code.
 */
const modules = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `mods/m${index}`).flatMap(
    (directory) => [
      `${directory}/src/a.ts`,
      `${directory}/src/b.ts`,
      `${directory}/src/c.ts`,
      `${directory}/test/scenario.test.ts`,
    ],
  );

describe("buildTerritories with many modules that each have placed tests", () => {
  it("builds the tree of 2000 of them in a time far below what a scan of every home per folder takes", () => {
    const start = performance.now();

    const tree = buildTerritories({
      files: modules(2000).map((path) => file(path)),
      changes: [],
      packages: new Set(),
      minChanges: 5,
    });

    // The quadratic version took two minutes; this takes a second or less.
    expect(performance.now() - start).toBeLessThan(30_000);
    expect(tree.nodes.length).toBeGreaterThan(1);
  });
});
