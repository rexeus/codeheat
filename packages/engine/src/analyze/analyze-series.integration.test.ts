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
  quartersSpreading,
  repeated,
  touching,
  FILE_B,
} from "../testing/quarters.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

layer(NodeServices.layer)("analyze series", (it) => {
  it.effect(
    "measures the change radius and the propagation cost of each quarter of the window",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createTwoPackages(repo);
        // 10 changes a quarter, 0, 2, 5, and 8 of them touching both packages
        yield* commitQuarters(repo, quartersSpreading([0, 2, 5, 8]));

        const { series } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          series.map((window) => [window.changes, window.active]),
          [
            [10, true],
            [10, true],
            [10, true],
            [10, true],
          ],
        );
        assert.deepStrictEqual(
          series.map((window) => window.changeRadius?.local),
          [1, 0.8, 0.5, 0.2],
        );
        // b has three changes only in the last two quarters, so only there are two files to couple
        assert.deepStrictEqual(
          series.map((window) => window.propagationCost?.cost ?? null),
          [null, null, 1, 1],
        );
      }),
  );

  it.effect("cuts the window into equal quarters that meet and cover it", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo);

      const { series } = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(
        series.map((window) => window.since),
        [
          "2025-06-01T12:00:00.000Z",
          "2025-08-31T18:00:00.000Z",
          "2025-12-01T00:00:00.000Z",
          "2026-03-02T06:00:00.000Z",
        ],
      );
      assert.deepStrictEqual(
        series.map((window) => window.until),
        [
          "2025-08-31T18:00:00.000Z",
          "2025-12-01T00:00:00.000Z",
          "2026-03-02T06:00:00.000Z",
          "2026-06-01T12:00:00.000Z",
        ],
      );
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
          [10, true],
          [2, false],
          [0, false],
          [0, false],
        ],
      );
      assert.strictEqual(series[2]?.changeRadius, null);
    }),
  );

  it.effect("has no series for a window shorter than six weeks", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo);
      yield* commitInMonth(repo, "2026-05", repeated(12, FILE_A));

      const report = yield* analyze(analyzeOptionsFor(repo, { since: "1m" }));

      assert.deepStrictEqual(report.series, []);
    }),
  );
});
