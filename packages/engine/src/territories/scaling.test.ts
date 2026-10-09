import { describe, expect, it } from "vitest";

import { buildTerritories } from "./build-territories.js";

const file = (path: string) => ({
  path,
  loc: 10,
  complexity: { total: 5 },
  changes: 2,
});

/** `count` sibling modules of three code files each. */
const modules = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `mods/m${index}`).flatMap(
    (directory) => [
      `${directory}/src/a.ts`,
      `${directory}/src/b.ts`,
      `${directory}/src/c.ts`,
    ],
  );

describe("buildTerritories with many modules", () => {
  it("builds the tree of 2000 of them in far less time than a scan of every folder per folder takes", () => {
    const start = performance.now();

    const tree = buildTerritories({
      files: modules(2000).map((path) => file(path)),
      changes: [],
      packages: new Set(),
      minChanges: 5,
    });

    expect(performance.now() - start).toBeLessThan(30_000);
    expect(tree.nodes.length).toBeGreaterThan(1);
  });
});
