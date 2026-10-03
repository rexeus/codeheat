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

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

/** Analyzes the twelve months of a repository whose quarters spread as `both` says (see `quartersSpreading`). */
const erosionOf = (both: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    yield* setNow;
    const repo = yield* makeTempRepository;
    yield* createTwoPackages(repo);
    yield* commitQuarters(repo, quartersSpreading(both));
    return yield* analyze(analyzeOptionsFor(repo));
  });

layer(NodeServices.layer)("analyze erosion", (it) => {
  it.effect(
    "calls a design eroding whose changes reach more modules each quarter",
    () =>
      Effect.gen(function* () {
        const report = yield* erosionOf([0, 2, 5, 8]);

        // local share 1, .8, .5, .2: the robust line falls from 1.0583 to .2083
        assert.deepStrictEqual(report.erosion?.verdict, "eroding");
        assert.deepStrictEqual(report.erosion?.locality, {
          from: 1.0583,
          to: 0.2083,
          slope: -0.2833,
        });
        const a = report.modules.find(({ path }) => path === "packages/a");
        assert.deepStrictEqual(a?.erosion, {
          from: 1.0583,
          to: 0.2083,
          slope: -0.2833,
          verdict: "eroding",
          windows: 4,
          cohesion: [1, 0.8, 0.5, 0.2],
          recent: true,
        });
        // b has enough changes in two quarters only
        const b = report.modules.find(({ path }) => path === "packages/b");
        assert.strictEqual(b?.erosion, null);
      }),
  );

  it.effect(
    "calls a design improving whose changes reach fewer modules each quarter",
    () =>
      Effect.gen(function* () {
        const report = yield* erosionOf([8, 5, 2, 0]);

        assert.strictEqual(report.erosion?.verdict, "improving");
      }),
  );

  it.effect("holds a design whose changes keep their reach", () =>
    Effect.gen(function* () {
      const report = yield* erosionOf([3, 3, 3, 3]);

      assert.strictEqual(report.erosion?.verdict, "holding");
    }),
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
        // changes reaching more modules for three quarters, then nothing for two
        yield* commitQuarters(repo, [...quartersSpreading([0, 3, 6]), [], []]);

        const report = yield* analyze(
          analyzeOptionsFor(repo, { since: "24m" }),
        );

        assert.deepStrictEqual(
          report.series.map(({ active }) => active),
          [false, false, false, true, true, true, false, false],
        );
        assert.strictEqual(report.erosion?.verdict, "eroding");
        assert.strictEqual(report.erosion?.locality?.to, 0.4);
        assert.strictEqual(
          report.erosion?.inactiveSince,
          report.series[6]?.since,
        );
      }),
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

  it.effect("has no erosion without a series", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createTwoPackages(repo);
      yield* commitInMonth(repo, "2026-05", repeated(12, FILE_A));

      const report = yield* analyze(analyzeOptionsFor(repo, { since: "1m" }));

      assert.strictEqual(report.erosion, null);
    }),
  );
});
