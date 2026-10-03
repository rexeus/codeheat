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
} from "../testing/quarters.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

// Five quarters of 28 changes are 140 commits, each a git process: more than vitest's 5 s under load.
const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

/** Analyzes a repository whose last quarters, of 28 changes each, spread as `both` says (see `quartersSpreading`). */
const erosionOf = (both: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    yield* setNow;
    const repo = yield* makeTempRepository;
    yield* createTwoPackages(repo);
    yield* commitQuarters(repo, quartersSpreading(both, 28));
    return yield* analyze(analyzeOptionsFor(repo));
  });

layer(NodeServices.layer)("analyze erosion", (it) => {
  it.effect(
    "calls a design eroding whose changes reach more modules each quarter",
    () =>
      Effect.gen(function* () {
        const report = yield* erosionOf([0, 7, 14, 21, 28]);

        // local share 1, .75, .5, .25, 0 in five quarters: the line falls by a quarter a window
        assert.deepStrictEqual(report.erosion?.verdict, "eroding");
        assert.deepStrictEqual(report.erosion?.locality, {
          from: 1,
          to: 0,
          slope: -0.25,
        });
        const a = report.modules.find(({ path }) => path === "packages/a");
        assert.deepStrictEqual(a?.erosion, {
          from: 1,
          to: 0,
          slope: -0.25,
          verdict: "eroding",
          windows: 5,
          cohesion: [null, null, null, 1, 0.75, 0.5, 0.25, 0],
          recent: true,
        });
        // b has enough changes in three quarters only, and never changes alone
        const b = report.modules.find(({ path }) => path === "packages/b");
        assert.strictEqual(b?.erosion?.windows, 3);
        assert.strictEqual(b?.erosion?.verdict, "holding");
      }),
    60_000,
  );

  it.effect(
    "calls a design improving whose changes reach fewer modules each quarter",
    () =>
      Effect.gen(function* () {
        const report = yield* erosionOf([28, 21, 14, 7, 0]);

        assert.strictEqual(report.erosion?.verdict, "improving");
      }),
    60_000,
  );

  it.effect(
    "holds a design whose changes keep their reach",
    () =>
      Effect.gen(function* () {
        const report = yield* erosionOf([14, 14, 14, 14, 14]);

        assert.strictEqual(report.erosion?.verdict, "holding");
      }),
    60_000,
  );
});

layer(NodeServices.layer)("analyze erosion of a quiet repository", (it) => {
  it.effect(
    "judges the active period of a repository that has since gone quiet, and says since when",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createTwoPackages(repo);
        // changes reaching more modules for five quarters, then nothing for two
        yield* commitQuarters(repo, [
          ...quartersSpreading([0, 7, 14, 21, 28], 28),
          [],
          [],
        ]);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.series.map(({ active }) => active),
          [false, true, true, true, true, true, false, false],
        );
        assert.strictEqual(report.erosion?.verdict, "eroding");
        assert.strictEqual(report.erosion?.locality?.to, 0);
        assert.strictEqual(
          report.erosion?.inactiveSince,
          report.series[6]?.since,
        );
      }),
    60_000,
  );

  it.effect("is unknown when too few quarters have the changes to judge", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo);
      yield* commitInMonth(repo, "2026-01", repeated(10, FILE_A));
      yield* commitInMonth(repo, "2026-04", repeated(10, FILE_A));

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(report.erosion?.verdict, "unknown");
      assert.strictEqual(report.erosion?.windows, 2);
    }),
  );

  it.effect("has no erosion without a series, in a history of four weeks", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo, "2026-05-01T12:00:00Z");
      yield* commitInMonth(repo, "2026-05", repeated(12, FILE_A));

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(report.erosion, null);
    }),
  );
});
