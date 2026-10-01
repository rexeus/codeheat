import { describe, expect, it } from "vitest";

import { isTestPath } from "./test-path.js";

describe("isTestPath", () => {
  it("recognizes test files by suffix and files below a test directory", () => {
    const tests = [
      "src/a.test.ts",
      "src/a_spec.rb",
      "src/__tests__/api.ts",
      "packages/app/e2e/flow.ts",
      "test/helper.ts",
      "src/fixtures/deep/data.ts",
    ];

    expect(tests.map((path) => isTestPath(path))).toStrictEqual(
      tests.map(() => true),
    );
  });

  it("leaves source files, even when named like a test directory or alike", () => {
    const sources = ["src/api.ts", "src/test", "test.ts", "src/contest/y.ts"];

    expect(sources.map((path) => isTestPath(path))).toStrictEqual(
      sources.map(() => false),
    );
  });
});
