import { describe, expect, it } from "vitest";

import { buildTerritories } from "./build-territories.js";
import type { TerritoryTree } from "./build-territories.js";

const code = (path: string) => ({
  path,
  loc: 10,
  complexity: { total: 5 },
  changes: 1,
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

const packageWith = (loose: number) =>
  buildTerritories({
    files: [
      ...Array.from(
        { length: loose },
        (_, index) => `pkg/loose${index}.ts`,
      ).map((path) => code(path)),
      ...filesIn("pkg/src/a", 3).map((path) => code(path)),
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

describe("a package with a source folder and files beside it", () => {
  it.each([1, 3, 12])(
    "splits into the folders of its source folder, its %s loose files a node of their own at the package's directory",
    (loose) => {
      expect(
        kindsAt(packageWith(loose), 2).toSorted(([a], [b]) =>
          String(a).localeCompare(String(b)),
        ),
      ).toStrictEqual([
        ["lib", "folder", 14],
        ["pkg/*", "files", loose],
        ["pkg/src/a", "folder", 3],
        ["pkg/src/b", "folder", 3],
        ["tools", "folder", 14],
      ]);
    },
  );
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
