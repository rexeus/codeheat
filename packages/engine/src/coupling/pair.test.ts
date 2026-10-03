import { describe, expect, it } from "vitest";

import {
  directoryDistance,
  isTestFile,
  isTestPair,
  testedStems,
} from "./pair.js";

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

describe("isTestPair below fixture and support directories", () => {
  it.each([
    ["src/testing/a.ts", "src/testing/a.test.ts"],
    ["src/fixtures/a.ts", "src/fixtures/a.test.ts"],
    ["src/__mocks__/a.ts", "src/__mocks__/a_spec.ts"],
  ])("pairs %s with its test %s beside it", (source, test) => {
    expect(isTestPair(source, test)).toBe(true);
  });

  it("never mirrors a test below a fixtures directory to a source", () => {
    expect(isTestPair("src/a.ts", "test/fixtures/a.test.ts")).toBe(false);
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
    ["main/a/b.ts", "test/a/b.test.ts"],
    ["app/src/main/a.kt", "app/src/test/a.test.kt"],
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

describe("testedStems", () => {
  it("names the sources a test may test: beside it, and where a mirrored test directory puts it", () => {
    expect(testedStems("test/a/b.test.ts")).toStrictEqual([
      "test/a/b",
      "src/a/b",
      "lib/a/b",
      "a/b",
    ]);
    expect(testedStems("src/c_spec.rb")).toStrictEqual(["src/c"]);
  });

  it("names nothing for a file without a test suffix, and nothing mirrored below a fixtures directory", () => {
    expect(testedStems("test/helpers/setup.ts")).toStrictEqual([]);
    expect(testedStems("test/fixtures/a.test.ts")).toStrictEqual([
      "test/fixtures/a",
    ]);
  });
});
