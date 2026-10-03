import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { InvalidHalfLife, resolveHalfLife } from "./half-life.js";

describe("resolveHalfLife", () => {
  it.effect("counts days, weeks, 30-day months, and 365-day years", () =>
    Effect.gen(function* () {
      const days = yield* Effect.forEach(["90d", "2w", "6m", "1y"], (input) =>
        resolveHalfLife(input),
      );

      assert.deepStrictEqual(days, [90, 14, 180, 365]);
    }),
  );

  it.effect("resolves 0, which turns weighting off, to 0", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* resolveHalfLife("0"), 0);
    }),
  );

  it.effect("rejects anything but 0 and a positive whole duration", () =>
    Effect.gen(function* () {
      const inputs = [
        "",
        "soon",
        "6",
        "0d",
        "-1d",
        "1.5y",
        "6M",
        "06m",
        "6 m",
        "99999999999999999999y",
      ];

      const failures = yield* Effect.forEach(inputs, (input) =>
        Effect.flip(resolveHalfLife(input)),
      );

      assert.deepStrictEqual(
        failures,
        inputs.map((input) => new InvalidHalfLife({ input })),
      );
    }),
  );
});
