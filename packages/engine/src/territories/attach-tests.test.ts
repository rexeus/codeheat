import { describe, expect, it } from "vitest";

import { isTestPath } from "../modules/test-path.js";
import { attachTests } from "./attach-tests.js";
import { buildTerritories } from "./build-territories.js";

describe("attachTests", () => {
  it("pairs a test with the source it mirrors or sits beside", () => {
    const attachment = attachTests([
      "src/a/b.ts",
      "test/a/b.test.ts",
      "src/c.ts",
      "src/c.spec.ts",
      "lib/d.ts",
      "lib/__tests__/d.test.ts",
    ]);

    expect([...attachment.pairedWith]).toStrictEqual([
      ["test/a/b.test.ts", "src/a/b.ts"],
      ["src/c.spec.ts", "src/c.ts"],
      ["lib/__tests__/d.test.ts", "lib/d.ts"],
    ]);
    expect(attachment.units).toStrictEqual([
      "lib/d.ts",
      "src/a/b.ts",
      "src/c.ts",
    ]);
  });

  it("places an unpaired test below a test directory with the code beside the directory", () => {
    const attachment = attachTests([
      "packages/x/src/index.ts",
      "packages/x/src/a/b.ts",
      "packages/x/test/helpers.ts",
      "packages/x/test/a/setup.ts",
      "packages/y/index.ts",
      "packages/y/__mocks__/db.ts",
    ]);

    expect([...attachment.placedIn]).toStrictEqual([
      ["packages/x/test/helpers.ts", "packages/x/src"],
      ["packages/x/test/a/setup.ts", "packages/x/src/a"],
      ["packages/y/__mocks__/db.ts", "packages/y"],
    ]);
  });

  it("leaves test code with no code beside it on its own", () => {
    const attachment = attachTests([
      "packages/x/src/index.ts",
      "e2e/flow.ts",
      "docs/examples/__tests__/demo.ts",
      "test-only/spec/a.ts",
    ]);

    expect([...attachment.pairedWith, ...attachment.placedIn]).toStrictEqual(
      [],
    );
    expect(attachment.units).toStrictEqual([
      "docs/examples/__tests__/demo.ts",
      "e2e/flow.ts",
      "packages/x/src/index.ts",
      "test-only/spec/a.ts",
    ]);
  });

  it("places a top-level test directory with the code of the `src` beside it", () => {
    const attachment = attachTests(["src/a.ts", "test/helpers/setup.ts"]);

    expect([...attachment.placedIn]).toStrictEqual([
      ["test/helpers/setup.ts", "src"],
    ]);
  });
});

const sources = (package_: string): ReadonlyArray<string> =>
  [1, 2, 3, 4].map((index) => `${package_}/src/f${index}.ts`);
const mirrored = (package_: string): ReadonlyArray<string> =>
  [1, 2, 3, 4].map((index) => `${package_}/test/f${index}.test.ts`);

describe("territories and test code", () => {
  const files = [
    ...sources("a"),
    ...mirrored("a"),
    ...sources("b"),
    ...mirrored("b"),
    ...[1, 2, 3, 4].map((index) => `e2e/f${index}.ts`),
  ];
  const tree = buildTerritories({
    files: files.map((path) => ({
      path,
      loc: 10,
      complexity: { total: 5 },
      changes: 1,
      test: isTestPath(path),
    })),
    changes: [],
    packages: new Set(["a", "b"]),
    minChanges: 5,
  });
  const detail = tree.details[0]?.ids ?? [];
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));

  it("counts a test for the territory of the code it tests, files and heat alike", () => {
    expect(
      detail.map((id) => {
        const node = byId.get(id);
        return [
          node?.path,
          node?.kind,
          node?.files,
          node?.testFiles,
          node?.heatShare,
        ];
      }),
    ).toStrictEqual([
      ["a", "package", 8, 4, 0.4],
      ["b", "package", 8, 4, 0.4],
      ["e2e", "tests", 4, 4, 0.2],
    ]);
    expect(tree.territoryOf.get("a/test/f1.test.ts")).toBe(
      tree.territoryOf.get("a/src/f1.ts"),
    );
  });

  it("shows test code that belongs to no code apart, after the code", () => {
    expect(byId.get(detail.at(-1) ?? "")?.lead).toBe("test code");
    expect(tree.recommended).toBe(1);
  });
});
