import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeCoupledProject } from "../testing/projects.js";

const analyzeJson = (cwd: string, ...flags: ReadonlyArray<string>) =>
  journey({ args: ["analyze", "--json", ...flags], cwd }).pipe(
    Effect.flatMap((result) =>
      Schema.decodeUnknownEffect(Report)(JSON.parse(result.stdout)),
    ),
  );

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat analyze --half-life", () => {
  it.live("weighs changes by a half-life of six months by default", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const report = yield* analyzeJson(repo.root);

      expect(report.thresholds.halfLifeDays).toBe(180);
    }).pipe(Effect.scoped),
  );

  it.live("reads a duration and weighs older changes less", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const report = yield* analyzeJson(repo.root, "--half-life", "30d");

      // src/a.ts changed 30, 20, 10, and 5 days ago: 0.5 + 0.63 + 0.79 + 0.89
      const a = report.files.find(({ path }) => path === "src/a.ts");
      expect(report.thresholds.halfLifeDays).toBe(30);
      expect(a?.revisions).toBe(4);
      expect(a?.weightedRevisions).toBeCloseTo(2.82, 1);
    }).pipe(Effect.scoped),
  );

  it.live("weighs every change 1 with 0", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const report = yield* analyzeJson(repo.root, "--half-life", "0");

      const a = report.files.find(({ path }) => path === "src/a.ts");
      expect(report.thresholds.halfLifeDays).toBe(0);
      expect([a?.revisions, a?.weightedRevisions]).toStrictEqual([4, 4]);
    }).pipe(Effect.scoped),
  );

  it.live("is accepted by inspect, which reports it in days", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", "src/a.ts", "--half-life", "90d", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(result.stdout),
      );
      expect(inspected.halfLifeDays).toBe(90);
    }).pipe(Effect.scoped),
  );
});

describe("codeheat --half-life usage", () => {
  it.live("says in the help that a month is 30 days and a year 365", () =>
    Effect.gen(function* () {
      const result = yield* journey({ args: ["analyze", "--help"] });

      expect(result.stdout.replaceAll(/\s+/gu, " ")).toContain(
        "(a month is 30 days and a year 365 here, unlike --since)",
      );
    }).pipe(Effect.scoped),
  );

  it.live("exits 2 on a half-life it cannot read, leaving stdout empty", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--half-life", "soon"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        'codeheat: invalid --half-life "soon": use <n>d, <n>w, <n>m, <n>y or 0',
      );
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});
