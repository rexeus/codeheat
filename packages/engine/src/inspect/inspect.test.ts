import { describe, expect, it } from "vitest";

import type { Coupling, FileStats, Report } from "../report/report.js";
import { inspect } from "./inspect.js";

const stats = (path: string, rank: number, revisions: number): FileStats => ({
  path,
  rank,
  score: 1 / rank,
  revisions,
  linesAdded: 0,
  linesDeleted: 0,
  breadth: 0,
  loc: 10,
  complexity: { total: 5, mean: 0.5, max: 2 },
  reasons: [],
});

const coupling = (
  a: string,
  b: string,
  sharedCommits: number,
  testPair = false,
): Coupling => ({ a, b, sharedCommits, degree: 0.5, distance: 0, testPair });

const reportOf = (
  files: ReadonlyArray<FileStats>,
  couplings: ReadonlyArray<Coupling> = [],
): Report => ({
  schemaVersion: 1,
  tool: { name: "codeheat", version: "0.0.0-test" },
  generatedAt: "2026-06-01T12:00:00.000Z",
  repository: { name: "repo", head: null, scope: ".", shallow: false },
  window: {
    since: "2025-06-01T12:00:00.000Z",
    until: "2026-06-01T12:00:00.000Z",
    commits: 40,
    couplingCommits: 38,
  },
  thresholds: {
    maxCommitFiles: 50,
    hubMinBreadth: 10,
    hubMinRevisions: 5,
    hubTopShare: 0.05,
    minSharedCommits: 3,
    minDegree: 0.3,
    maxMeanLineLength: 300,
    maxFileBytes: 1_048_576,
  },
  totals: { files: files.length, couplings: couplings.length },
  files,
  couplings,
});

const universe = [
  stats("src/a.ts", 1, 10),
  stats("src/b.ts", 2, 5),
  stats("lib/c.ts", 3, 4),
  stats("src/[id].ts", 4, 2),
];

describe("inspect matching", () => {
  it("reports an exact path with its rank of the whole universe", () => {
    const result = inspect(reportOf(universe), ["src/b.ts"]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      path: "src/b.ts",
      rank: 2,
      of: 4,
      revisions: 5,
    });
    expect(result.unmatched).toStrictEqual([]);
    expect(result.window).toStrictEqual(reportOf(universe).window);
  });

  it("reports every file a glob matches, sorted by rank", () => {
    const shuffled = [
      universe[1],
      universe[3],
      universe[0],
      universe[2],
    ].filter((file) => file !== undefined);

    const result = inspect(reportOf(shuffled), ["src/*.ts"]);

    expect(result.matches.map(({ path, rank }) => [path, rank])).toStrictEqual([
      ["src/a.ts", 1],
      ["src/b.ts", 2],
      ["src/[id].ts", 4],
    ]);
  });

  it("matches an exact path that contains glob characters", () => {
    const result = inspect(reportOf(universe), ["src/[id].ts"]);

    expect(result.matches.map(({ path }) => path)).toStrictEqual([
      "src/[id].ts",
    ]);
  });

  it("lists a pattern that matches no universe file under unmatched", () => {
    const result = inspect(reportOf(universe), [
      "src/a.ts",
      "nope/**",
      "gone.ts",
    ]);

    expect(result.matches.map(({ path }) => path)).toStrictEqual(["src/a.ts"]);
    expect(result.unmatched).toStrictEqual(["nope/**", "gone.ts"]);
  });
});

describe("inspect partners", () => {
  it("sorts partners by co-change probability and keeps at most ten", () => {
    // hub.ts changed in 20 commits and shares 3 to 14 of them with twelve files
    const partners = Array.from({ length: 12 }, (_, index) => `p${index}.ts`);
    const couplings = partners.map((path, index) =>
      coupling("hub.ts", path, index + 3),
    );
    const report = reportOf([stats("hub.ts", 1, 20)], couplings);

    const [entry] = inspect(report, ["hub.ts"]).matches;

    // p11.ts shares 14 commits (0.7), p2.ts shares 5 (0.25); p1.ts and p0.ts fall off
    expect(entry?.partners.map(({ path }) => path)).toStrictEqual(
      ["p11", "p10", "p9", "p8", "p7", "p6", "p5", "p4", "p3", "p2"].map(
        (name) => `${name}.ts`,
      ),
    );
    expect(entry?.partners[0]).toStrictEqual({
      path: "p11.ts",
      sharedCommits: 14,
      probability: 0.7,
      testPair: false,
    });
  });

  it("rounds the co-change probability to four decimals", () => {
    const report = reportOf(
      [stats("a.ts", 1, 7), stats("b.ts", 2, 3)],
      [coupling("a.ts", "b.ts", 3)],
    );

    const [a] = inspect(report, ["a.ts"]).matches;

    // 3 shared commits / 7 revisions = 0.42857
    expect(a?.partners[0]?.probability).toBe(0.4286);
  });

  it("finds partners on either side of a coupling with the probability of the focused file", () => {
    const report = reportOf(
      [stats("a.ts", 1, 10), stats("b.ts", 2, 4)],
      [coupling("a.ts", "b.ts", 4)],
    );

    const [a, b] = inspect(report, ["*.ts"]).matches;

    expect(a?.partners).toStrictEqual([
      { path: "b.ts", sharedCommits: 4, probability: 0.4, testPair: false },
    ]);
    expect(b?.partners).toStrictEqual([
      { path: "a.ts", sharedCommits: 4, probability: 1, testPair: false },
    ]);
  });

  it("marks a partner that is the file's test as a test pair", () => {
    const report = reportOf(
      [stats("src/a.ts", 1, 10)],
      [coupling("src/a.test.ts", "src/a.ts", 5, true)],
    );

    const [entry] = inspect(report, ["src/a.ts"]).matches;

    expect(entry?.partners).toStrictEqual([
      {
        path: "src/a.test.ts",
        sharedCommits: 5,
        probability: 0.5,
        testPair: true,
      },
    ]);
  });
});
