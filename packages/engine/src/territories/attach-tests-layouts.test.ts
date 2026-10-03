import { describe, expect, it } from "vitest";

import { isTestPath } from "../modules/test-path.js";
import { attachTests } from "./attach-tests.js";
import { buildTerritories } from "./build-territories.js";
import type { TerritoryTree } from "./build-territories.js";

describe("attachTests for a Maven or Gradle layout", () => {
  const attachment = attachTests([
    "svc/src/main/java/com/x/Foo.java",
    "svc/src/main/java/com/x/Bar.java",
    "svc/src/main/kotlin/Baz.kt",
    "svc/src/test/java/com/x/FooTest.java",
    "svc/src/test/java/com/x/BarIT.java",
    "svc/src/test/java/com/x/FixtureSupport.java",
    "svc/src/test/kotlin/BazSpec.kt",
  ]);

  it("pairs a test class with the class it is named after in the main tree", () => {
    expect([...attachment.pairedWith]).toStrictEqual([
      [
        "svc/src/test/java/com/x/FooTest.java",
        "svc/src/main/java/com/x/Foo.java",
      ],
      [
        "svc/src/test/java/com/x/BarIT.java",
        "svc/src/main/java/com/x/Bar.java",
      ],
      ["svc/src/test/kotlin/BazSpec.kt", "svc/src/main/kotlin/Baz.kt"],
    ]);
  });

  it("places any other test code with the main code its test directory mirrors", () => {
    expect([...attachment.placedIn]).toStrictEqual([
      [
        "svc/src/test/java/com/x/FixtureSupport.java",
        "svc/src/main/java/com/x",
      ],
    ]);
  });
});

const filesIn = (folder: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${folder}/f${index + 1}.ts`);

const heated = (paths: ReadonlyArray<string>, changes: number) =>
  paths.map((path) => ({
    path,
    loc: 10,
    complexity: { total: 5 },
    changes,
    test: isTestPath(path),
  }));

const nodeAt = (tree: TerritoryTree, level: number): TerritoryTree["nodes"] =>
  (tree.details[level - 1]?.ids ?? []).flatMap(
    (id) => tree.nodes.find((node) => node.id === id) ?? [],
  );

describe("test code whose home is split", () => {
  const changes = [
    ...Array.from({ length: 12 }, () => ["app/src/a/f1.ts"]),
    ...Array.from({ length: 12 }, () => ["app/src/b/f1.ts"]),
  ];
  const tree = buildTerritories({
    files: [
      ...heated(filesIn("app/src/a", 4), 1),
      ...heated(filesIn("app/src/b", 4), 1),
      ...heated(filesIn("app/test/helpers", 3), 10),
      ...heated(filesIn("lib", 14), 1),
      ...heated(filesIn("tools", 14), 1),
    ],
    changes,
    packages: new Set(),
    minChanges: 5,
  });

  it("gets a tests territory beside the parts instead of inflating one of them", () => {
    expect(
      nodeAt(tree, 2).map(({ path, kind, files, testFiles }) => [
        path,
        kind,
        files,
        testFiles,
      ]),
    ).toStrictEqual([
      ["lib", "folder", 14, 0],
      ["tools", "folder", 14, 0],
      ["app/src/a", "folder", 4, 0],
      ["app/src/b", "folder", 4, 0],
      ["app/test/helpers", "tests", 3, 3],
    ]);
  });

  it("counts the tests for the territory that holds all the code at a coarser detail", () => {
    expect(
      nodeAt(tree, 1).map(({ path, files, testFiles }) => [
        path,
        files,
        testFiles,
      ]),
    ).toStrictEqual([
      ["app/src", 11, 3],
      ["lib", 14, 0],
      ["tools", 14, 0],
    ]);
  });
});
