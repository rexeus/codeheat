import { describe, expect, it } from "vitest";

import { buildTerritories } from "./build-territories.js";
import type { TerritoryTree } from "./build-territories.js";

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

const kindsAt = (tree: TerritoryTree, level: number) =>
  (tree.details[level - 1]?.ids ?? []).map((id) => {
    const node = tree.nodes.find((candidate) => candidate.id === id);
    return [node?.path, node?.kind, node?.files];
  });

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

  it("splits into the folders of its source folder, the config file a node of its own at the package's directory", () => {
    expect(kindsAt(tree, 2)).toStrictEqual([
      ["lib", "folder", 14],
      ["tools", "folder", 14],
      ["pkg/src/a", "folder", 3],
      ["pkg/src/b", "folder", 3],
      ["pkg", "other", 1],
    ]);
  });
});

const layout = (loose: number) =>
  buildTerritories({
    files: [
      ...filesIn("svc", loose).map((path) => code(path)),
      ...["a", "b", "c"].map((name) => code(`svc/internal/${name}.go`)),
      ...filesIn("lib", 14).map((path) => code(path)),
    ],
    changes: [],
    packages: new Set(),
    minChanges: 5,
  });

describe("a directory with code of its own beside one folder", () => {
  it.each([3, 30])(
    "stays one territory when it has %s loose files, with no node for the folder's files",
    (loose) => {
      const tree = layout(loose);

      expect(
        tree.nodes
          .map(({ path, kind }) => `${path} ${kind}`)
          .toSorted((a, b) => a.localeCompare(b)),
      ).toStrictEqual([". folder", "lib folder", "svc folder"]);
      expect(tree.recommended).toBe(1);
    },
  );
});
