import { describe, expect, it } from "vitest";

import { rankFiles } from "./hotspots.js";
import type { FileMeasure } from "./hotspots.js";

/** A flat file of 10 lines: `revisions` changes that weigh `weightedRevisions` together. */
const measure = (
  path: string,
  revisions: number,
  weightedRevisions: number,
): FileMeasure => ({
  path,
  module: ".",
  revisions,
  weightedRevisions,
  changes: revisions,
  linesAdded: 0,
  linesDeleted: 0,
  breadth: 0,
  complexity: { loc: 10, total: 0, mean: 0, max: 0 },
});

describe("rankFiles recency", () => {
  it("scores by weighted revisions, so a recently changed file passes an old one with more revisions", () => {
    const ranked = rankFiles(
      [measure("old.ts", 20, 3), measure("recent.ts", 8, 7)],
      [],
    );

    // ln(1 + 3) / ln(1 + 7) = 0.6667 for the old file; the recent one has the largest weight
    expect(ranked.map(({ path, score }) => [path, score])).toStrictEqual([
      ["recent.ts", 1],
      ["old.ts", 0.6667],
    ]);
  });

  it("reports the raw revisions next to the weighted ones, rounded to four decimals", () => {
    const [file] = rankFiles([measure("a.ts", 20, 3.123_456)], []);

    expect([file?.revisions, file?.weightedRevisions]).toStrictEqual([
      20, 3.1235,
    ]);
  });

  it("words the reason by the raw revisions", () => {
    const [file] = rankFiles([measure("a.ts", 20, 3)], []);

    expect(file?.reasons).toStrictEqual(["changed in 20 commits (#1 of 1)"]);
  });

  it("keeps the weight of a file that only changed long ago above zero", () => {
    const [file] = rankFiles([measure("a.ts", 3, 0.000_012_349)], []);

    expect(file?.weightedRevisions).toBe(0.000_012_35);
  });
});
