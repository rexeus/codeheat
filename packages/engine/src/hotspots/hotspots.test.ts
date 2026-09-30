import { describe, expect, it } from "vitest";

import type { Coupling } from "../report/report.js";
import { rankFiles } from "./hotspots.js";
import type { FileMeasure } from "./hotspots.js";

/** A file whose weighted lines are `loc + complexityTotal`. */
const measure = (
  path: string,
  revisions: number,
  loc: number,
  complexityTotal: number,
): FileMeasure => ({
  path,
  revisions,
  linesAdded: revisions * 10,
  linesDeleted: revisions,
  complexity: { loc, total: complexityTotal, mean: 1.5, max: 4 },
});

const coupling = (
  a: string,
  b: string,
  sharedCommits: number,
  testPair = false,
): Coupling => ({ a, b, sharedCommits, degree: 0.5, distance: 0, testPair });

describe("rankFiles", () => {
  // log-max normalization: revisions max 7 gives log(1+r)/log(8) = 1, 2/3, 1/3, 0
  // for 7, 3, 1, 0; weighted lines max 15 gives log(1+w)/log(16) = 1/2 for 3 and 1 for 15
  const files = [
    measure("a.ts", 7, 2, 1),
    measure("b.ts", 3, 10, 5),
    measure("c.ts", 1, 10, 5),
    measure("d.ts", 0, 10, 5),
  ];

  it("orders files by normalized revisions times normalized weighted lines", () => {
    const ranked = rankFiles(files, []);

    expect(ranked.map(({ path, rank }) => [path, rank])).toStrictEqual([
      ["b.ts", 1],
      ["a.ts", 2],
      ["c.ts", 3],
      ["d.ts", 4],
    ]);
    expect(ranked.map(({ score }) => score)).toStrictEqual([
      0.6667, 0.5, 0.3333, 0,
    ]);
  });

  it("breaks ties on path", () => {
    const ranked = rankFiles(
      [
        measure("b.ts", 3, 10, 5),
        measure("a.ts", 3, 10, 5),
        measure("c.ts", 0, 0, 0),
      ],
      [],
    );

    expect(ranked.map(({ path }) => path)).toStrictEqual([
      "a.ts",
      "b.ts",
      "c.ts",
    ]);
  });

  it("scores zero for a file without revisions", () => {
    const ranked = rankFiles(
      [measure("a.ts", 0, 5, 5), measure("b.ts", 4, 5, 5)],
      [],
    );

    expect(ranked.at(-1)).toMatchObject({ path: "a.ts", score: 0 });
  });

  it("carries the measured facts into the stats", () => {
    const [top] = rankFiles(files, []);

    expect(top).toMatchObject({
      path: "b.ts",
      revisions: 3,
      linesAdded: 30,
      linesDeleted: 3,
      loc: 10,
      complexity: { total: 5, mean: 1.5, max: 4 },
    });
  });
});

describe("rankFiles weighting and precision", () => {
  it("scores a flat file by its lines, so a barrel that keeps changing stays visible", () => {
    // weighted lines 40 (40 + 0) against 120 (60 + 60), both 7 revisions
    const ranked = rankFiles(
      [measure("index.ts", 7, 40, 0), measure("deep.ts", 7, 60, 60)],
      [],
    );

    expect(ranked.map(({ score }) => score)).toStrictEqual([
      1,
      // ln(41) / ln(121) = 0.77434
      0.7743,
    ]);
  });

  it("rounds the reported complexity mean to four decimals", () => {
    const [ranked] = rankFiles(
      [
        {
          ...measure("a.ts", 1, 3, 1),
          complexity: { loc: 3, total: 1, mean: 1 / 3, max: 1 },
        },
      ],
      [],
    );

    expect(ranked?.complexity.mean).toBe(0.3333);
  });
});

describe("rankFiles reasons", () => {
  const files = [
    measure("a.ts", 7, 100, 3),
    measure("b.ts", 3, 100, 15),
    measure("c.ts", 1, 100, 15),
    measure("d.ts", 0, 100, 15),
  ];

  it("explains a file by its revision and complexity ranks", () => {
    const byPath = new Map(
      rankFiles(files, []).map((stats) => [stats.path, stats.reasons]),
    );

    expect(byPath.get("b.ts")).toStrictEqual([
      "changed in 3 commits (#2 of 4)",
      "indentation complexity 15 (#1 of 4)",
    ]);
    expect(byPath.get("a.ts")).toStrictEqual([
      "changed in 7 commits (#1 of 4)",
      "indentation complexity 3 (#4 of 4)",
    ]);
    expect(byPath.get("c.ts")?.[0]).toBe("changed in 1 commit (#3 of 4)");
    expect(byPath.get("d.ts")).toStrictEqual([
      "indentation complexity 15 (#1 of 4)",
    ]);
  });

  it("explains a file by its strongest co-change partner, never by its test", () => {
    const byPath = new Map(
      rankFiles(files, [
        coupling("a.ts", "b.ts", 3),
        coupling("a.ts", "a.test.ts", 6, true),
      ]).map((stats) => [stats.path, stats.reasons]),
    );

    expect(byPath.get("a.ts")?.at(-1)).toBe(
      "co-changes with b.ts in 43% of its commits",
    );
    expect(byPath.get("b.ts")?.at(-1)).toBe(
      "co-changes with a.ts in 100% of its commits",
    );
  });
});
