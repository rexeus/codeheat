import { Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  makeShallowClone,
  makeTempDirectory,
} from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import {
  makeCoupledProject,
  makeTestPairProject,
} from "../testing/projects.js";

const decode = (stdout: string) =>
  Schema.decodeUnknownEffect(Report)(JSON.parse(stdout));

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat analyze against a git repository", () => {
  it.live(
    "prints one JSON document to stdout that decodes with the Report schema",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(report.files.map(({ path }) => path)).toStrictEqual([
          "src/a.ts",
          "src/b.ts",
          "src/c.ts",
        ]);
        expect(report.couplings).toMatchObject([
          {
            a: "src/a.ts",
            b: "src/b.ts",
            sharedCommits: 4,
            crossesModule: false,
          },
        ]);
        expect(report.modules).toMatchObject([
          { path: "src", kind: "directory", commits: 4, cohesion: 1 },
        ]);
      }).pipe(Effect.scoped),
  );

  it.live(
    "truncates files, couplings and modules to --limit and leaves totals untouched",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;

        const result = yield* journey({
          args: ["analyze", "--json", "--limit", "1"],
          cwd: repo.root,
        });

        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(report.files.map(({ path }) => path)).toStrictEqual([
          "src/a.ts",
        ]);
        expect(report.totals).toStrictEqual({
          files: 3,
          couplings: 1,
          modules: 1,
        });
      }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze --entry", () => {
  it.live("replaces the detected entry points with the given globs", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const detected = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });
      const overridden = yield* journey({
        args: ["analyze", "--json", "--entry", "src/a.ts", "--entry", "nope/*"],
        cwd: repo.root,
      });

      expect((yield* decode(detected.stdout)).modules).toMatchObject([
        { entryPoints: [], leakage: null },
      ]);
      expect(overridden.stderr).toBe("");
      // a.ts changes in all 4 commits, and b.ts or c.ts changes in each of them
      expect((yield* decode(overridden.stdout)).modules).toMatchObject([
        {
          entryPoints: ["src/a.ts"],
          interfaceCommits: 4,
          implementationCommits: 4,
          leakage: 1,
        },
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("warns once on stderr when the globs select no file", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: [
          "analyze",
          "--json",
          "--entry",
          "nope/*",
          "--entry",
          "*.nothing",
        ],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe(
        "codeheat: --entry matched no file of the analysis universe",
      );
      expect((yield* decode(result.stdout)).modules).toMatchObject([
        { entryPoints: [], leakage: null },
      ]);
    }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze paths", () => {
  it.live("analyzes a repository given as a path from outside it", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;
      const elsewhere = yield* makeTempDirectory;

      const result = yield* journey({
        args: ["analyze", repo.root, "--json"],
        cwd: elsewhere,
      });

      expect(result.exitCode).toBe(0);
      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(result.stdout),
      );
      expect(report.repository.scope).toBe(".");
      expect(report.totals.files).toBe(3);
    }).pipe(Effect.scoped),
  );

  it.live("analyzes a single file given as the path", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["analyze", "src/a.ts", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(result.stdout),
      );
      expect(report.repository.scope).toBe("src/a.ts");
      expect(report.files.map(({ path }) => path)).toStrictEqual(["src/a.ts"]);
      expect(report.files[0]?.revisions).toBe(4);
    }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze terminal view", () => {
  it.live(
    "picks the terminal's couplings from the whole report, whatever --limit says",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTestPairProject;

        const result = yield* journey({
          args: ["analyze", "--limit", "1"],
          cwd: repo.root,
        });

        expect(result.stdout).toContain("src/b.ts <-> src/c.ts");
        expect(result.stdout).not.toContain("No change coupling");
        // the hotspot table is not cut to one row either
        expect(result.stdout).toContain("src/a.test.ts");
        expect(result.stdout).toContain("Least cohesive modules");
      }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze --compare", () => {
  // Commits 30, 20, 10, and 5 days ago: the latest 2 weeks hold the last two, the 2 weeks before hold the one at 20 days.
  it.live("adds the previous window and per-file trends to the JSON", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["analyze", "--compare", "2w", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(result.stdout),
      );
      expect(report.comparison?.previousUntil).toBe(report.window.since);
      expect(report.window.commits).toBe(2);
      expect(
        report.files.map(({ path, trend }) => [path, trend !== null]),
      ).toStrictEqual([
        ["src/a.ts", true],
        ["src/b.ts", true],
        ["src/c.ts", true],
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("shows the biggest changes in the terminal view", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["analyze", "--compare", "2w"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Biggest changes against");
    }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze --compare beyond the history", () => {
  it.live(
    "says there is no comparison data when --compare reaches back past the first commit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;

        const terminal = yield* journey({
          args: ["analyze", "--compare", "15y"],
          cwd: repo.root,
        });
        const json = yield* journey({
          args: ["analyze", "--compare", "15y", "--json"],
          cwd: repo.root,
        });

        expect(terminal.stdout).toContain(
          "No comparison data: the previous window has no commits.",
        );
        expect(terminal.stdout).toContain("Note: the previous window reaches");
        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(json.stdout),
        );
        expect(report.comparison).toMatchObject({
          previousCommits: 0,
          previousTruncated: true,
        });
        expect(report.files.every((file) => file.trend === null)).toBe(true);
      }).pipe(Effect.scoped),
  );
});

describe("codeheat analyze a shallow clone", () => {
  it.live(
    "warns once on stderr about a shallow clone and keeps stdout to the JSON",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;
        const clone = yield* makeShallowClone(repo, 2);

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: clone,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe(
          "codeheat: shallow clone: history before its oldest fetched commit is missing; run git fetch --unshallow for full results",
        );
        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(report.repository.shallow).toBe(true);
      }).pipe(Effect.scoped),
  );

  it.live(
    "also warns that a comparison reaching past the oldest fetched commit is incomplete",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;
        const clone = yield* makeShallowClone(repo, 2);

        const result = yield* journey({
          args: ["analyze", "--compare", "2w", "--json"],
          cwd: clone,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr.split("\n")).toStrictEqual([
          "codeheat: shallow clone: history before its oldest fetched commit is missing; run git fetch --unshallow for full results",
          "codeheat: shallow clone: the previous window reaches past the oldest fetched commit, so the comparison is incomplete",
        ]);
        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(report.comparison?.previousTruncated).toBe(true);
      }).pipe(Effect.scoped),
  );

  it.live("stays silent on stderr for a complete repository", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stderr).toBe("");
    }).pipe(Effect.scoped),
  );
});
