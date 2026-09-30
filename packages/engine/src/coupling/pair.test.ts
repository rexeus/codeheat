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
  ])("recognizes %s and %s", (a, b) => {
    expect(isTestPair(a, b)).toBe(true);
  });

  it.each([
    ["src/a.ts", "src/b.test.ts"],
    ["src/a.ts", "test/a.test.ts"],
    ["src/a.test.ts", "src/a.spec.ts"],
    ["src/a.ts", "src/a.ts"],
  ])("does not pair %s with %s", (a, b) => {
    expect(isTestPair(a, b)).toBe(false);
  });
});

describe("isTestFile", () => {
  it.each(["src/a.test.ts", "src/a.spec.tsx", "lib/a_test.py"])(
    "recognizes %s",
    (path) => {
      expect(isTestFile(path)).toBe(true);
    },
  );

  it.each(["src/a.ts", "src/test/a.ts", "src/attest.ts"])(
    "does not take %s for a test",
    (path) => {
      expect(isTestFile(path)).toBe(false);
    },
  );
});
