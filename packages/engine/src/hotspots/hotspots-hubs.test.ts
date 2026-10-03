import { describe, expect, it } from "vitest";

import { rankFiles } from "./hotspots.js";
import type { FileMeasure } from "./hotspots.js";

/** A file of 4 flat lines changed `revisions` times, together with `breadth` other files. */
const wide = (
  path: string,
  revisions: number,
  breadth: number,
): FileMeasure => ({
  path,
  module: ".",
  revisions,
  changes: revisions,
  linesAdded: revisions * 10,
  linesDeleted: revisions,
  breadth,
  complexity: { loc: 4, total: 0, mean: 1.5, max: 4 },
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

  it("counts a file's logical changes, not its commits, toward the candidate floor", () => {
    // ten commits that make up four changes: below the floor of five
    const files = [
      { ...wide("busy.ts", 10, 30), changes: 4 },
      ...narrowFiles(19),
    ];

    expect(reasonsOf(files, "busy.ts")).toStrictEqual([
      "changed in 10 commits (#1 of 20)",
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

  it("neither ranks nor names test code below a test directory, however wide", () => {
    // step files, mocks and fixtures are test code by their directory alone
    const files = [
      wide("test/steps/checkout.ts", 5, 30),
      wide("src/__tests__/mock.ts", 5, 30),
      wide("hub.ts", 5, 10),
      ...narrowFiles(17),
    ];

    expect(reasonsOf(files, "test/steps/checkout.ts")).toStrictEqual([
      "changed in 5 commits (#1 of 20)",
    ]);
    expect(reasonsOf(files, "src/__tests__/mock.ts")).toStrictEqual([
      "changed in 5 commits (#1 of 20)",
    ]);
    expect(reasonsOf(files, "hub.ts")?.at(-1)).toBe(
      "changes together with 10 different files",
    );
  });
});

describe("rankFiles hub ties", () => {
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
