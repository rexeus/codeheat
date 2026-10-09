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

  it("recognizes files below a test support directory", () => {
    const support = [
      "packages/core/testing/index.ts",
      "src/testing/projects.ts",
      "src/test-utils/render.tsx",
      "src/test-helpers/db.ts",
      "src/__mocks__/fs.ts",
      "src/mocks/handlers.ts",
      "src/__snapshots__/a.snap",
    ];

    expect(support.map((path) => isTestPath(path))).toStrictEqual(
      support.map(() => true),
    );
  });

  it("keeps a contract file below a support directory a contract, and a file that only has the name", () => {
    expect(isTestPath("src/mocks/api.tsp")).toBe(false);
    expect(isTestPath("src/testing.ts")).toBe(false);
    expect(isTestPath("src/mocks")).toBe(false);
    expect(isTestPath("src/mockery/a.ts")).toBe(false);
  });

  it("takes a test below a spec directory for test code but not a contract file", () => {
    expect(isTestPath("spec/helpers/setup.ts")).toBe(true);
    expect(isTestPath("spec/a.test.ts")).toBe(true);
    expect(isTestPath("spec/main.tsp")).toBe(false);
    expect(isTestPath("specs/api/openapi.yaml")).toBe(false);
    expect(isTestPath("test/schemas/user.schema.json")).toBe(false);
    expect(isTestPath("packages/api/spec/events.proto")).toBe(false);
  });

  it("leaves source files, even when named like a test directory or alike", () => {
    const sources = ["src/api.ts", "src/test", "test.ts", "src/contest/y.ts"];

    expect(sources.map((path) => isTestPath(path))).toStrictEqual(
      sources.map(() => false),
    );
  });
});

describe("isTestPath by name", () => {
  it.each([
    "src/a.test.ts",
    "src/a.spec.tsx",
    "lib/a_test.py",
    "src/a_spec.ts",
  ])("recognizes %s", (path) => {
    expect(isTestPath(path)).toBe(true);
  });

  it.each(["src/a.ts", "src/test", "src/attest.ts", "src/a-test.ts"])(
    "does not take %s for a test",
    (path) => {
      expect(isTestPath(path)).toBe(false);
    },
  );
});
