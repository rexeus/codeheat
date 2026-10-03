import { describe, expect, it } from "vitest";

import { hotFiles } from "./hot-files.js";

const complexity = { loc: 40, total: 60, mean: 1.5, max: 4 };

const file = (path: string, revisions: number) => ({
  path,
  revisions,
  complexity,
});

const files = (revisions: ReadonlyArray<number>) =>
  revisions.map((count, index) => file(`f${index}.ts`, count));

describe("hotFiles", () => {
  it("takes the best tenth of the files, rounded up", () => {
    // 11 files: ceil(1.1) = 2 are hot
    expect(hotFiles(files([9, 7, 5, 4, 3, 3, 2, 2, 1, 1, 1]))).toStrictEqual(
      new Set(["f0.ts", "f1.ts"]),
    );
  });

  it("takes at least one file", () => {
    expect(hotFiles(files([2, 1, 1]))).toStrictEqual(new Set(["f0.ts"]));
  });

  it("keeps every file tied at the cut-off", () => {
    expect(hotFiles(files([5, 5, 5, 1, 1]))).toStrictEqual(
      new Set(["f0.ts", "f1.ts", "f2.ts"]),
    );
  });

  it("ranks by revisions and size together, as the score does", () => {
    const big = { loc: 400, total: 900, mean: 2, max: 8 };

    expect(
      hotFiles([
        file("few-small.ts", 2),
        { path: "few-big.ts", revisions: 2, complexity: big },
        file("many-small.ts", 3),
      ]),
    ).toStrictEqual(new Set(["few-big.ts"]));
  });

  it("is empty without files", () => {
    expect(hotFiles([])).toStrictEqual(new Set());
  });
});
