import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { InvalidSince, resolveTimeRange } from "./analysis-window.js";

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
