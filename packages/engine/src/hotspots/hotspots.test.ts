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
  module: ".",
  revisions,
  linesAdded: revisions * 10,
  linesDeleted: revisions,
  breadth: 0,
  complexity: { loc, total: complexityTotal, mean: 1.5, max: 4 },
});

const coupling = (
  a: string,
  b: string,
  sharedCommits: number,
  testPair = false,
): Coupling => ({
  a,
  b,
  sharedCommits,
  degree: 0.5,
  distance: 0,
  testPair,
  crossesModule: false,
  imports: null,
});

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
      breadth: 0,
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

const hidden = (a: string, b: string, sharedCommits: number): Coupling => ({
  ...coupling(a, b, sharedCommits),
  imports: "none",
});

describe("rankFiles hidden coupling reason", () => {
  const files = [
    measure("a.ts", 7, 100, 3),
    measure("b.ts", 3, 100, 15),
    measure("x.ts", 4, 100, 3),
    measure("p.ts", 4, 100, 3),
    measure("q.ts", 2, 100, 3),
  ];
  const reasonsFor = (
    path: string,
    couplings: ReadonlyArray<Coupling>,
  ): ReadonlyArray<string> | undefined =>
    rankFiles(files, couplings).find((stats) => stats.path === path)?.reasons;

  it("replaces the co-change reason when the strongest partner is hidden", () => {
    const reasons = reasonsFor("b.ts", [hidden("a.ts", "b.ts", 3)]);

    expect(reasons?.slice(2)).toStrictEqual([
      "changes with a.ts in 100% of its commits without an import between them",
    ]);
  });

  it("stays silent below 50%, where the partner is only a co-change", () => {
    const reasons = reasonsFor("a.ts", [hidden("a.ts", "b.ts", 3)]);

    expect(reasons?.slice(2)).toStrictEqual([
      "co-changes with b.ts in 43% of its commits",
    ]);
  });

  it("does not call an imported pair or a pair with unknown imports hidden", () => {
    const imported = {
      ...coupling("a.ts", "b.ts", 3),
      imports: "a→b",
    } as const;
    const unknown = coupling("a.ts", "b.ts", 3);

    expect(reasonsFor("b.ts", [imported])?.at(-1)).toBe(
      "co-changes with a.ts in 100% of its commits",
    );
    expect(reasonsFor("b.ts", [unknown])?.at(-1)).toBe(
      "co-changes with a.ts in 100% of its commits",
    );
  });

  it("does not call a file's test hidden", () => {
    const testPair = { ...hidden("a.ts", "b.ts", 3), testPair: true };

    expect(reasonsFor("b.ts", [testPair])?.slice(2)).toStrictEqual([]);
  });

  it("words only the strongest non-test partner, so a weaker hidden one stays a co-change", () => {
    const reasons = reasonsFor("x.ts", [
      { ...coupling("p.ts", "x.ts", 4), imports: "a→b" },
      hidden("q.ts", "x.ts", 2),
    ]);

    expect(reasons?.slice(2)).toStrictEqual([
      "co-changes with p.ts in 100% of its commits",
    ]);
  });
});

/** A file of 4 flat lines changed `revisions` times, together with `breadth` other files. */
const wide = (
  path: string,
  revisions: number,
  breadth: number,
): FileMeasure => ({
  ...measure(path, revisions, 4, 0),
  breadth,
});

/** `count` files changed once together with one other file. */
const narrowFiles = (count: number): ReadonlyArray<FileMeasure> =>
  Array.from({ length: count }, (_, index) => wide(`f${index}.ts`, 1, 1));

const reasonsOf = (
  files: ReadonlyArray<FileMeasure>,
  path: string,
): ReadonlyArray<string> | undefined =>
  rankFiles(files, []).find((stats) => stats.path === path)?.reasons;

describe("rankFiles hub reason", () => {
  it("names the breadth of a file that is wide enough and among the widest 5% of the universe", () => {
    // the only candidate: the top 5% is ceil(1 * 0.05) = 1 file
    const files = [wide("hub.ts", 5, 10), ...narrowFiles(19)];

    expect(reasonsOf(files, "hub.ts")?.at(-1)).toBe(
      "changes together with 10 different files",
    );
    expect(reasonsOf(files, "f0.ts")).toStrictEqual([
      "changed in 1 commit (#2 of 20)",
    ]);
  });

  it("stays silent below a breadth of 10", () => {
    const files = [wide("hub.ts", 5, 9), ...narrowFiles(19)];

    expect(reasonsOf(files, "hub.ts")).toStrictEqual([
      "changed in 5 commits (#1 of 20)",
    ]);
  });

  it("stays silent for a wide candidate outside the widest 5% of the candidates", () => {
    // breadth ranks 1 and 2 of 2 candidates; the top 5% is ceil(2 * 0.05) = 1 file
    const files = [
      wide("wide.ts", 5, 12),
      wide("next.ts", 5, 11),
      ...narrowFiles(18),
    ];

    expect(reasonsOf(files, "wide.ts")?.at(-1)).toBe(
      "changes together with 12 different files",
    );
    expect(reasonsOf(files, "next.ts")).toStrictEqual([
      "changed in 5 commits (#1 of 20)",
    ]);
  });
});

describe("rankFiles hub candidates", () => {
  it("stays silent for a file changed once, however many files its one commit touched", () => {
    const files = [wide("once.ts", 1, 49), ...narrowFiles(19)];

    expect(reasonsOf(files, "once.ts")).toStrictEqual([
      "changed in 1 commit (#1 of 20)",
    ]);
  });

  it("neither ranks nor names a test file, however wide", () => {
    // the test file would take breadth rank 1 and push hub.ts out of the top 5%
    const files = [
      wide("hub.test.ts", 5, 30),
      wide("hub.ts", 5, 10),
      ...narrowFiles(18),
    ];

    expect(reasonsOf(files, "hub.test.ts")).toStrictEqual([
      "changed in 5 commits (#1 of 20)",
    ]);
    expect(reasonsOf(files, "hub.ts")?.at(-1)).toBe(
      "changes together with 10 different files",
    );
  });

  it("includes every candidate tied at the cut-off", () => {
    // 20 candidates: the top 5% is 1 file, and both widest files share rank 1
    const files = [
      wide("a.ts", 5, 12),
      wide("b.ts", 5, 12),
      ...Array.from({ length: 18 }, (_, index) => wide(`f${index}.ts`, 5, 1)),
    ];

    expect(reasonsOf(files, "a.ts")?.at(-1)).toBe(
      "changes together with 12 different files",
    );
    expect(reasonsOf(files, "b.ts")?.at(-1)).toBe(
      "changes together with 12 different files",
    );
    expect(reasonsOf(files, "f0.ts")).toStrictEqual([
      "changed in 5 commits (#1 of 20)",
    ]);
  });
});

describe("rankFiles test flag", () => {
  it("marks files with a test suffix or below a test directory", () => {
    const paths = [
      "src/a.ts",
      "src/a.test.ts",
      "src/a_spec.rb",
      "test/utils.ts",
      "src/__tests__/a.ts",
      "src/test",
    ];

    const files = rankFiles(
      paths.map((path) => measure(path, 1, 10, 0)),
      [],
    );

    expect(
      files
        .toSorted((a, b) => a.path.localeCompare(b.path))
        .map((file) => [file.path, file.test]),
    ).toEqual([
      ["src/__tests__/a.ts", true],
      ["src/a_spec.rb", true],
      ["src/a.test.ts", true],
      ["src/a.ts", false],
      ["src/test", false],
      ["test/utils.ts", true],
    ]);
  });
});
