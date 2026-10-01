import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import {
  InvalidCompare,
  InvalidSince,
  resolveComparisonRanges,
  resolveTimeRange,
} from "./analysis-window.js";

const setNow = TestClock.setTime(Date.parse("2026-06-15T10:30:00Z"));

describe("resolveTimeRange", () => {
  it.effect.each([
    { since: "30d", expected: "2026-05-16T10:30:00.000Z" },
    { since: "2w", expected: "2026-06-01T10:30:00.000Z" },
    { since: "12m", expected: "2025-06-15T10:30:00.000Z" },
    { since: "1y", expected: "2025-06-15T10:30:00.000Z" },
    { since: "2026-01-31", expected: "2026-01-31T00:00:00.000Z" },
  ])("resolves $since against the clock to $expected", ({ since, expected }) =>
    Effect.gen(function* () {
      yield* setNow;

      const range = yield* resolveTimeRange(since);

      assert.deepStrictEqual(range, {
        since: expected,
        until: "2026-06-15T10:30:00.000Z",
      });
    }),
  );

  it.effect.each([
    "",
    "0d",
    "12",
    "5x",
    "-3d",
    "3 d",
    "2026-02-30",
    "2026-1-1",
    "yesterday",
    // after the clock's now of 2026-06-15
    "2026-06-16",
    "2030-01-01",
    // before the earliest date JavaScript can represent
    "999999999y",
    "999999999m",
  ])("rejects %j", (since) =>
    Effect.gen(function* () {
      yield* setNow;

      const failure = yield* Effect.flip(resolveTimeRange(since));

      assert.deepStrictEqual(failure, new InvalidSince({ input: since }));
    }),
  );
});

describe("resolveComparisonRanges", () => {
  it.effect.each([
    {
      compare: "30d",
      current: "2026-05-16T10:30:00.000Z",
      previous: "2026-04-16T10:30:00.000Z",
    },
    {
      compare: "3m",
      current: "2026-03-15T10:30:00.000Z",
      previous: "2025-12-15T10:30:00.000Z",
    },
    {
      compare: "1y",
      current: "2025-06-15T10:30:00.000Z",
      previous: "2024-06-15T10:30:00.000Z",
    },
  ])(
    "resolves $compare to adjacent windows split at $current",
    ({ compare, current, previous }) =>
      Effect.gen(function* () {
        yield* setNow;

        const ranges = yield* resolveComparisonRanges(compare);

        assert.deepStrictEqual(ranges, {
          current: { since: current, until: "2026-06-15T10:30:00.000Z" },
          previous: { since: previous, until: current },
        });
      }),
  );

  it.effect.each(["", "0d", "3", "2026-01-31", "yesterday", "999999999y"])(
    "rejects %j",
    (compare) =>
      Effect.gen(function* () {
        yield* setNow;

        const failure = yield* Effect.flip(resolveComparisonRanges(compare));

        assert.deepStrictEqual(failure, new InvalidCompare({ input: compare }));
      }),
  );
});
