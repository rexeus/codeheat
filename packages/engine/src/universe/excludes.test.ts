import { describe, expect, it } from "vitest";

import { activeExcludes, applyExcludes, excludingPattern } from "./excludes.js";

const patternOf = (
  paths: ReadonlyArray<string>,
  excludes: ReturnType<typeof activeExcludes>,
) => {
  const excludedBy = excludingPattern(excludes);
  return paths.map((path) => [path, excludedBy(path)?.pattern]);
};

describe("the default exclude patterns", () => {
  it("leave out test code, mocks, fixtures, snapshots, generated and minified files, build output, coverage, and dependencies", () => {
    expect(
      patternOf(
        [
          "a.test.ts",
          "src/a.spec.tsx",
          "src/__tests__/a.ts",
          "src/__mocks__/fs.ts",
          "test/setup.ts",
          "packages/core/tests/a.ts",
          "apps/web/e2e/flow.ts",
          "test-data/fixtures/order.ts",
          "src/__fixtures__/user.ts",
          "src/__snapshots__/view.ts",
          "src/types.gen.ts",
          "src/api.generated.ts",
          "public/jquery.min.js",
          "dist/index.js",
          "packages/x/build/out.js",
          "coverage/lcov-report/a.js",
          "packages/api/generated/client.ts",
          "src/__generated__/schema.ts",
          "tsp-output/openapi.yaml",
          "vendor/lib.go",
          "web/node_modules/pkg/index.js",
        ],
        activeExcludes([], true),
      ),
    ).toStrictEqual([
      ["a.test.ts", "**/*.test.*"],
      ["src/a.spec.tsx", "**/*.spec.*"],
      ["src/__tests__/a.ts", "**/__tests__/**"],
      ["src/__mocks__/fs.ts", "**/__mocks__/**"],
      ["test/setup.ts", "**/test/**"],
      ["packages/core/tests/a.ts", "**/tests/**"],
      ["apps/web/e2e/flow.ts", "**/e2e/**"],
      ["test-data/fixtures/order.ts", "**/fixtures/**"],
      ["src/__fixtures__/user.ts", "**/__fixtures__/**"],
      ["src/__snapshots__/view.ts", "**/__snapshots__/**"],
      ["src/types.gen.ts", "**/*.gen.*"],
      ["src/api.generated.ts", "**/*.generated.*"],
      ["public/jquery.min.js", "**/*.min.*"],
      ["dist/index.js", "**/dist/**"],
      ["packages/x/build/out.js", "**/build/**"],
      ["coverage/lcov-report/a.js", "**/coverage/**"],
      ["packages/api/generated/client.ts", "**/generated/**"],
      ["src/__generated__/schema.ts", "**/__generated__/**"],
      ["tsp-output/openapi.yaml", "**/tsp-output/**"],
      ["vendor/lib.go", "**/vendor/**"],
      ["web/node_modules/pkg/index.js", "**/node_modules/**"],
    ]);
  });
});

describe("the default exclude patterns beside production code", () => {
  it("keep production code and the test conventions of other languages", () => {
    expect(
      patternOf(
        [
          "src/app.ts",
          "src/build.ts",
          "src/testing/projects.ts",
          "spec/main.tsp",
          "src/a_test.go",
        ],
        activeExcludes([], true),
      ),
    ).toStrictEqual([
      ["src/app.ts", undefined],
      ["src/build.ts", undefined],
      ["src/testing/projects.ts", undefined],
      ["spec/main.tsp", undefined],
      ["src/a_test.go", undefined],
    ]);
  });
});

describe("activeExcludes", () => {
  it("adds the user's patterns after the defaults, each pattern once", () => {
    const excludes = activeExcludes([".repos/**", "**/dist/**"], true);

    expect(excludes.at(-1)).toStrictEqual({
      pattern: ".repos/**",
      source: "user",
    });
    expect(
      excludes.filter(({ pattern }) => pattern === "**/dist/**"),
    ).toStrictEqual([{ pattern: "**/dist/**", source: "default" }]);
  });

  it("applies only the user's patterns without the defaults", () => {
    expect(activeExcludes(["src/gen/**"], false)).toStrictEqual([
      { pattern: "src/gen/**", source: "user" },
    ]);
    expect(activeExcludes([], false)).toStrictEqual([]);
  });
});

describe("applyExcludes", () => {
  it("keeps the unmatched paths in order and counts each left-out path for the first pattern that matches it", () => {
    const excludes = activeExcludes(["src/**", "lib/**", "docs/**"], false);

    expect(
      applyExcludes(["src/a.ts", "app.ts", "lib/b.ts", "src/c.ts"], excludes),
    ).toStrictEqual({
      kept: ["app.ts"],
      excluded: [
        { pattern: "src/**", source: "user", files: 2 },
        { pattern: "lib/**", source: "user", files: 1 },
        { pattern: "docs/**", source: "user", files: 0 },
      ],
    });
  });

  it("counts a path for the first of two patterns that match it", () => {
    const excludes = activeExcludes(["**/*.test.*", "test/**"], false);

    expect(applyExcludes(["test/a.test.ts"], excludes).excluded).toStrictEqual([
      { pattern: "**/*.test.*", source: "user", files: 1 },
      { pattern: "test/**", source: "user", files: 0 },
    ]);
  });
});
