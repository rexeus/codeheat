import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyze } from "../analyze/analyze.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { inspectFrom } from "./inspect-from.js";

const halfLifeDaysOf = (halfLife: string) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));
    const repo = yield* makeTempRepository;
    yield* repo.commit("2026-05-01T12:00:00Z", { "a.ts": "a\n" });
    const report = yield* analyze(analyzeOptionsFor(repo, { halfLife }));
    const result = yield* inspectFrom({
      cwd: repo.directory,
      report,
      patterns: ["a.ts"],
    });
    return result.halfLifeDays;
  });

layer(NodeServices.layer)("inspectFrom half-life", (it) => {
  it.effect("carries the half-life of the analysis in days", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* halfLifeDaysOf("90d"), 90);
    }),
  );

  it.effect("carries 0 when weighting is off", () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* halfLifeDaysOf("0"), 0);
    }),
  );
});
