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

  it.live("stays silent on stderr for a complete repository", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stderr).toBe("");
    }).pipe(Effect.scoped),
  );
});
