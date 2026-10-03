import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import {
  commitInMonth,
  commitQuarters,
  createTwoPackages,
  FILE_A,
  FILE_B,
  quartersSpreading,
  repeated,
  touching,
} from "../testing/quarters.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const FOUR_QUIET_QUARTERS = [0, 0, 0, 0];

layer(NodeServices.layer)("analyze series", (it) => {
  it.effect(
    "measures the change radius and the propagation cost of each quarter of the series",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createTwoPackages(repo);
        // 10 changes a quarter, 0, 2, 5, and 8 of them touching both packages
        yield* commitQuarters(repo, quartersSpreading([0, 2, 5, 8]));

        const { series } = yield* analyze(analyzeOptionsFor(repo));

        // the series covers 24 months, so four quiet quarters come first
        assert.deepStrictEqual(
          series.map((window) => [window.changes, window.active]),
          [
            ...FOUR_QUIET_QUARTERS.map((changes) => [changes, false]),
            [10, true],
            [10, true],
            [10, true],
            [10, true],
          ],
        );
        assert.deepStrictEqual(
          series.slice(4).map((window) => window.changeRadius?.local),
          [1, 0.8, 0.5, 0.2],
        );
        // b has three changes only in the last two quarters, so only there are two files to couple
        assert.deepStrictEqual(
          series.slice(4).map((window) => window.propagationCost?.cost ?? null),
          [null, null, 1, 1],
        );
      }),
  );

  it.effect(
    "covers the last 24 months in equal windows that meet, with the 12 months of the window inside",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createTwoPackages(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.strictEqual(report.window.since, "2025-06-01T12:00:00.000Z");
        assert.strictEqual(report.seriesSince, "2024-06-01T12:00:00.000Z");
        assert.strictEqual(report.series.length, 8);
        assert.strictEqual(report.series[0]?.since, report.seriesSince);
        assert.strictEqual(report.series[7]?.until, report.window.until);
        assert.deepStrictEqual(
          report.series.slice(1).map((window) => window.since),
          report.series.slice(0, -1).map((window) => window.until),
        );
      }),
  );
});

layer(NodeServices.layer)("analyze series span", (it) => {
  it.effect(
    "keeps the snapshot measures on the window, not on the series",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createTwoPackages(repo);
        yield* commitInMonth(repo, "2024-10", repeated(7, FILE_A));
        yield* commitInMonth(repo, "2026-04", repeated(3, FILE_A));

        const report = yield* analyze(analyzeOptionsFor(repo));

        // the seven changes of 2024 are in the series only
        assert.strictEqual(report.window.couplingCommits, 3);
        assert.strictEqual(
          report.series.reduce((sum, window) => sum + window.changes, 0),
          10,
        );
      }),
  );

  it.effect(
    "extends the series with a longer window, up to twelve windows",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createTwoPackages(repo, "2018-01-01T12:00:00Z");

        const report = yield* analyze(analyzeOptionsFor(repo, { since: "5y" }));

        assert.strictEqual(report.seriesSince, report.window.since);
        assert.strictEqual(report.series.length, 12);
      }),
  );
});

layer(NodeServices.layer)("analyze series windows", (it) => {
  it.effect("marks a window with too few changes inactive", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo);
      yield* commitInMonth(repo, "2025-07", repeated(10, FILE_A));
      yield* commitInMonth(repo, "2025-10", [
        touching(FILE_A),
        touching(FILE_A, FILE_B),
      ]);

      const { series } = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(
        series.map((window) => [window.changes, window.active]),
        [
          ...FOUR_QUIET_QUARTERS.map((changes) => [changes, false]),
          [10, true],
          [2, false],
          [0, false],
          [0, false],
        ],
      );
      assert.strictEqual(series[6]?.changeRadius, null);
    }),
  );

  it.effect("cuts the series of a comparison over the last 24 months too", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo);
      yield* commitInMonth(repo, "2025-08", repeated(10, FILE_A));
      yield* commitInMonth(repo, "2026-01", repeated(10, FILE_A));
      yield* commitInMonth(repo, "2026-04", repeated(12, FILE_A));

      const report = yield* analyze(analyzeOptionsFor(repo, { compare: "6m" }));

      // the window is the latest 6 months, the series the 24 before 2026-06-01
      assert.deepStrictEqual(
        report.series.map(({ changes }) => changes),
        [0, 0, 0, 0, 10, 0, 10, 12],
      );
      assert.strictEqual(report.seriesSince, "2024-06-01T12:00:00.000Z");
      assert.strictEqual(report.window.since, "2025-12-01T12:00:00.000Z");
    }),
  );
});

layer(NodeServices.layer)("analyze series of a young repository", (it) => {
  it.effect(
    "cuts the whole history of a repository younger than 24 months, 20 weeks being the least",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const twenty = yield* makeTempRepository;
        yield* createTwoPackages(twenty, "2026-01-12T12:00:00Z");
        const nineteen = yield* makeTempRepository;
        yield* createTwoPackages(nineteen, "2026-01-19T12:00:00Z");

        const long = yield* analyze(analyzeOptionsFor(twenty));
        const short = yield* analyze(analyzeOptionsFor(nineteen));

        assert.strictEqual(long.series.length, 2);
        assert.strictEqual(long.seriesSince, "2026-01-12T12:00:00.000Z");
        assert.deepStrictEqual(short.series, []);
        assert.strictEqual(short.seriesSince, null);
        assert.strictEqual(short.erosion, null);
      }),
  );

  it.effect("cuts a default run over a history of 18 months in full", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo, "2024-12-01T12:00:00Z");
      yield* commitQuarters(repo, quartersSpreading([0, 0, 0, 0, 5, 5]));

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(report.seriesSince, "2024-12-01T12:00:00.000Z");
      assert.strictEqual(report.series.length, 6);
      assert.strictEqual(report.series[5]?.until, report.window.until);
    }),
  );
});
