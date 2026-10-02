import { describe, expect, it } from "vitest";

import { directoryDistance, isTestFile, isTestPair } from "./pair.js";

describe("directoryDistance", () => {
  it("is 0 for files in the same directory", () => {
    expect(directoryDistance("src/a.ts", "src/b.ts")).toBe(0);
  });

  it("is 1 between a directory and its child", () => {
    expect(directoryDistance("a.ts", "src/b.ts")).toBe(1);
  });

  it("is 2 between sibling directories", () => {
    expect(directoryDistance("src/a/x.ts", "src/b/y.ts")).toBe(2);
  });

  it("counts the hops up and down between distant directories", () => {
    expect(
      directoryDistance("packages/x/src/a.ts", "packages/y/src/b.ts"),
    ).toBe(4);
  });
});

describe("isTestPair", () => {
  it.each([
    ["src/a.ts", "src/a.test.ts"],
    ["src/a.test.ts", "src/a.ts"],
    ["src/a.ts", "src/a.spec.tsx"],
    ["lib/a.py", "lib/a_test.py"],
    ["src/a.ts", "src/a_spec.ts"],
  ])("recognizes %s and %s", (a, b) => {
    expect(isTestPair(a, b)).toBe(true);
  });

  it.each([
    ["src/a.ts", "src/b.test.ts"],
    ["src/a.test.ts", "src/a.spec.ts"],
    ["src/a.ts", "src/a.ts"],
  ])("does not pair %s with %s", (a, b) => {
    expect(isTestPair(a, b)).toBe(false);
  });
});

describe("isTestPair for a mirrored test directory", () => {
  it.each([
    ["src/a/b.ts", "test/a/b.test.ts"],
    ["src/a/b.ts", "tests/a/b.spec.ts"],
    ["lib/x.ts", "__tests__/x.test.ts"],
    ["packages/p/src/y.ts", "packages/p/test/y.test.ts"],
    ["src/a.rb", "spec/a_spec.rb"],
    ["src/a.ts", "specs/a.spec.ts"],
    ["src/a.ts", "e2e/a.test.ts"],
    ["src/a.ts", "test/a_test.ts"],
    ["x.ts", "test/x.test.ts"],
    ["packages/p/x.ts", "packages/p/tests/x.spec.ts"],
    ["src/x.ts", "src/__tests__/x.test.ts"],
    ["src/a/x.ts", "src/a/__tests__/x.spec.ts"],
    ["packages/p/src/y.ts", "packages/p/src/test/y.test.tsx"],
  ])("pairs %s with %s, whichever comes first", (source, test) => {
    expect(isTestPair(source, test)).toBe(true);
    expect(isTestPair(test, source)).toBe(true);
  });

  it.each([
    ["src/a/b.ts", "test/c/b.test.ts"],
    ["src/a/b.ts", "test/b.test.ts"],
    ["src/a/b.ts", "test/a/c.test.ts"],
    ["packages/p/src/y.ts", "packages/q/test/y.test.ts"],
    ["packages/p/src/y.ts", "test/y.test.ts"],
    ["app/a.ts", "test/a.test.ts"],
    ["src/a.ts", "fixtures/a.test.ts"],
    ["src/a.ts", "testing/a.test.ts"],
  ])("does not pair %s with %s", (source, test) => {
    expect(isTestPair(source, test)).toBe(false);
    expect(isTestPair(test, source)).toBe(false);
  });

  it.each([
    ["src/a.ts", "test/a.ts"],
    ["src/steps/login.ts", "test/steps/login.steps.ts"],
    ["src/api.ts", "test/mocks/api.ts"],
    ["src/api.ts", "test/fixtures/api.ts"],
    ["src/a.test.ts", "test/a.test.ts"],
    ["src/fixtures/a.ts", "test/fixtures/a.test.ts"],
    ["fixtures/a.ts", "test/fixtures/a.spec.ts"],
    ["src/a.ts", "__fixtures__/a.test.ts"],
    ["src/a/b.ts", "tests/__fixtures__/a/b.test.ts"],
  ])(
    "leaves %s and %s, a helper, test input, or another test, unpaired",
    (a, b) => {
      expect(isTestPair(a, b)).toBe(false);
      expect(isTestPair(b, a)).toBe(false);
    },
  );
});

describe("isTestFile", () => {
  it.each([
    "src/a.test.ts",
    "src/a.spec.tsx",
    "lib/a_test.py",
    "src/a_spec.ts",
  ])("recognizes %s", (path) => {
    expect(isTestFile(path)).toBe(true);
  });

  it.each(["src/a.ts", "src/test/a.ts", "src/attest.ts"])(
    "does not take %s for a test",
    (path) => {
      expect(isTestFile(path)).toBe(false);
    },
  );
});
