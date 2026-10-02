import { describe, expect, it } from "vitest";

import type { Coupling, FileStats, Report } from "../report/report.js";
import { inspect } from "./inspect.js";

const stats = (path: string, rank: number, revisions: number): FileStats => ({
  path,
  test: false,
  module: path.startsWith("lib/") ? "lib" : "src",
  rank,
  score: 1 / rank,
  revisions,
  linesAdded: 0,
  linesDeleted: 0,
  breadth: 0,
  loc: 10,
  complexity: { total: 5, mean: 0.5, max: 2 },
  reasons: [],
  trend: null,
});

const coupling = (
  a: string,
  b: string,
  sharedCommits: number,
  flags: Partial<Pick<Coupling, "testPair" | "crossesModule" | "kinds">> = {},
): Coupling => ({
  a,
  b,
  sharedCommits,
  degree: 0.5,
  distance: 0,
  testPair: false,
  kinds: { a: "code", b: "code" },
  crossesModule: false,
  imports: null,
  ...flags,
});

// Least cohesive first, as `analyze` reports them.
const modules: Report["modules"] = [
  {
    path: "lib",
    kind: "directory",
    testOnly: false,
    files: 1,
    commits: 4,
    localCommits: 1,
    cohesion: 0.25,
    partners: [{ path: "src", sharedCommits: 3 }],
    entryPoints: [],
    interfaceCommits: 0,
    implementationCommits: 4,
    leakage: null,
    leakyInterface: false,
    depth: null,
    trend: null,
  },
  {
    path: "src",
    kind: "package",
    testOnly: false,
    files: 3,
    commits: 20,
    localCommits: 17,
    cohesion: 0.85,
    partners: [{ path: "lib", sharedCommits: 3 }],
    entryPoints: ["src/index.ts"],
    interfaceCommits: 4,
    implementationCommits: 20,
    leakage: 0.2,
    leakyInterface: false,
    depth: null,
    trend: null,
  },
];

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
  comparison: null,
  thresholds: {
    maxCommitFiles: 50,
    hubMinBreadth: 10,
    hubMinRevisions: 5,
    hubTopShare: 0.05,
    minModuleCommits: 5,
    minHiddenProbability: 0.5,
    minLeakage: 0.5,
    minImplementationCommits: 5,
    minSharedCommits: 3,
    minDegree: 0.3,
    maxMeanLineLength: 300,
    maxFileBytes: 1_048_576,
  },
  totals: {
    files: files.length,
    contracts: 0,
    couplings: couplings.length,
    modules: 2,
  },
  files,
  contracts: [],
  couplings,
  modules,
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
      kind: "code",
      testPair: false,
      crossesModule: false,
      imports: null,
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
});

describe("inspect partner marks", () => {
  it("finds partners on either side of a coupling with the probability of the focused file", () => {
    const report = reportOf(
      [stats("a.ts", 1, 10), stats("b.ts", 2, 4)],
      [coupling("a.ts", "b.ts", 4)],
    );

    const [a, b] = inspect(report, ["*.ts"]).matches;

    expect(a?.partners).toStrictEqual([
      {
        path: "b.ts",
        sharedCommits: 4,
        probability: 0.4,
        kind: "code",
        testPair: false,
        crossesModule: false,
        imports: null,
      },
    ]);
    expect(b?.partners).toStrictEqual([
      {
        path: "a.ts",
        sharedCommits: 4,
        probability: 1,
        kind: "code",
        testPair: false,
        crossesModule: false,
        imports: null,
      },
    ]);
  });

  it("marks a partner that is the file's test as a test pair", () => {
    const report = reportOf(
      [stats("src/a.ts", 1, 10)],
      [coupling("src/a.test.ts", "src/a.ts", 5, { testPair: true })],
    );

    const [entry] = inspect(report, ["src/a.ts"]).matches;

    expect(entry?.partners).toStrictEqual([
      {
        path: "src/a.test.ts",
        sharedCommits: 5,
        probability: 0.5,
        kind: "code",
        testPair: true,
        crossesModule: false,
        imports: null,
      },
    ]);
  });

  it("marks a partner in another module", () => {
    const report = reportOf(
      [stats("src/a.ts", 1, 10)],
      [coupling("lib/b.ts", "src/a.ts", 5, { crossesModule: true })],
    );

    const [entry] = inspect(report, ["src/a.ts"]).matches;

    expect(entry?.partners.map(({ crossesModule }) => crossesModule)).toEqual([
      true,
    ]);
  });
});

const importsSeenFrom = (focus: string, relation: Coupling["imports"]) => {
  const report = reportOf(
    [stats("src/a.ts", 1, 10), stats("src/b.ts", 2, 10)],
    [{ ...coupling("src/a.ts", "src/b.ts", 5), imports: relation }],
  );
  return inspect(report, [focus]).matches[0]?.partners[0]?.imports;
};

describe("inspect import relations", () => {
  it("reads a→b from the file's side: a file that imports its partner", () => {
    expect(importsSeenFrom("src/a.ts", "a→b")).toBe("file→partner");
    expect(importsSeenFrom("src/b.ts", "a→b")).toBe("partner→file");
  });

  it("reads b→a from the file's side: a file its partner imports", () => {
    expect(importsSeenFrom("src/a.ts", "b→a")).toBe("partner→file");
    expect(importsSeenFrom("src/b.ts", "b→a")).toBe("file→partner");
  });

  it("keeps both, none, and unknown the same from either side", () => {
    expect(importsSeenFrom("src/b.ts", "both")).toBe("both");
    expect(importsSeenFrom("src/a.ts", "none")).toBe("none");
    expect(importsSeenFrom("src/a.ts", null)).toBeNull();
  });
});

describe("inspect modules", () => {
  it("lists each module of the matched files once, in report order", () => {
    const result = inspect(reportOf(universe), [
      "src/b.ts",
      "src/a.ts",
      "lib/c.ts",
    ]);

    expect(result.modules.map(({ path }) => path)).toEqual(["lib", "src"]);
    expect(result.modules[0]).toEqual(modules[0]);
  });

  it("leaves out the modules of files that were not matched", () => {
    const result = inspect(reportOf(universe), ["src/*.ts"]);

    expect(result.modules.map(({ path }) => path)).toEqual(["src"]);
  });

  it("lists no module when nothing matched", () => {
    expect(inspect(reportOf(universe), ["nope.ts"]).modules).toEqual([]);
  });
});

describe("inspect contract partners", () => {
  it("tells a contract partner from a code partner", () => {
    const report = reportOf(
      [stats("src/a.ts", 1, 10)],
      [
        coupling("api/main.tsp", "src/a.ts", 5, {
          kinds: { a: "contract", b: "code" },
        }),
      ],
    );

    const [entry] = inspect(report, ["src/a.ts"]).matches;

    expect(entry?.partners.map(({ path, kind }) => [path, kind])).toStrictEqual(
      [["api/main.tsp", "contract"]],
    );
  });
});
