import { describe, expect, it } from "vitest";

import { buildTerritories } from "./build-territories.js";

const code = (path: string) => ({
  path,
  loc: 10,
  complexity: { total: 5 },
  changes: 1,
  test: false,
});

const filesIn = (folder: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${folder}/f${index + 1}.ts`);

const changed = (times: number, path: string) =>
  Array.from({ length: times }, () => [path]);

describe("a package with a source folder and a config file", () => {
  const tree = buildTerritories({
    files: [
      ...["pkg/vitest.config.ts", ...filesIn("pkg/src/a", 3)].map((path) =>
        code(path),
      ),
      ...filesIn("pkg/src/b", 3).map((path) => code(path)),
      ...filesIn("lib", 14).map((path) => code(path)),
      ...filesIn("tools", 14).map((path) => code(path)),
    ],
    changes: [
      ...changed(12, "pkg/src/a/f1.ts"),
      ...changed(12, "pkg/src/b/f1.ts"),
    ],
    packages: new Set(["pkg"]),
    minChanges: 5,
  });

  it("splits into the folders of its source folder, the config file staying loose", () => {
    const detail = (tree.details[1]?.ids ?? []).map((id) => {
      const node = tree.nodes.find((candidate) => candidate.id === id);
      return [node?.path, node?.kind];
    });

    expect(detail).toStrictEqual([
      ["lib", "folder"],
      ["tools", "folder"],
      ["pkg/src/a", "folder"],
      ["pkg/src/b", "folder"],
      ["pkg/src", "other"],
    ]);
  });
});
