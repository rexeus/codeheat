import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { lines } from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

layer(NodeServices.layer)("analyze propagation cost", (it) => {
  it.effect(
    "reaches the files a chain of couplings joins, leaving tests and a file that changes alone out of the graph",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2024-01-01T12:00:00Z", {
          "x.ts": lines(3, "x"),
          "x.test.ts": lines(3, "xt"),
          "y.ts": lines(3, "y"),
          "z.ts": lines(3, "z"),
          "w.ts": lines(3, "w"),
        });
        // x changes with y three times, y with z three times, w three times alone
        for (const step of [1, 2, 3]) {
          yield* repo.commit(day(step), {
            "x.ts": lines(3 + step, "x"),
            "x.test.ts": lines(3 + step, "xt"),
            "y.ts": lines(3 + step, "y"),
          });
          yield* repo.commit(day(step + 3), {
            "y.ts": lines(6 + step, "y"),
            "z.ts": lines(3 + step, "z"),
          });
          yield* repo.commit(day(step + 6), { "w.ts": lines(3 + step, "w") });
        }

        const report = yield* analyze(analyzeOptionsFor(repo));

        // x, y, z, and w each have 3 or more changes; x reaches y and z, y reaches x and z, z reaches x and y, w reaches none
        assert.deepStrictEqual(report.propagationCost, {
          cost: 0.5,
          files: 4,
        });
        assert.strictEqual(report.thresholds.propagationDepth, 3);
      }),
  );

  it.effect("is null when no file has enough changes to be coupled", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit(day(1), { "a.ts": lines(3, "a") });

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(report.propagationCost, null);
    }),
  );
});
