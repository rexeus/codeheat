import { describe, expect, it } from "vitest";

import { directoryDistance } from "./pair.js";

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
