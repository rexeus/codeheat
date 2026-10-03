import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const code = (indent: string, extra = "") =>
  Array.from(
    { length: 10 },
    (_, index) => `${indent}const value${index} = ${index};\n`,
  ).join("") + extra;

layer(NodeServices.layer)("analyze --compare with mechanical commits", (it) => {
  it.effect(
    "has nothing to compare when the previous window holds only a reformat",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": code("  ") });
        yield* repo.commit("2026-04-10T12:00:00Z", { "a.ts": code("    ") });
        yield* repo.commit("2026-05-10T12:00:00Z", {
          "a.ts": code("    ", "// edit\n"),
        });

        const report = yield* analyze(
          analyzeOptionsFor(repo, { compare: "1m" }),
        );

        assert.strictEqual(report.comparison?.previousCommits, 1);
        assert.strictEqual(report.comparison?.previousRealCommits, 0);
        assert.deepStrictEqual(report.window.realCommits, 1);
        assert.isTrue(report.files.every(({ trend }) => trend === null));
      }),
  );

  it.effect(
    "has nothing to compare when the latest window holds only a reformat",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": code("  ") });
        yield* repo.commit("2026-04-10T12:00:00Z", {
          "a.ts": code("  ", "// edit\n"),
        });
        yield* repo.commit("2026-05-10T12:00:00Z", {
          "a.ts": code("    ", "// edit\n"),
        });

        const report = yield* analyze(
          analyzeOptionsFor(repo, { compare: "1m" }),
        );

        assert.strictEqual(report.window.commits, 1);
        assert.strictEqual(report.window.realCommits, 0);
        assert.isTrue(report.files.every(({ trend }) => trend === null));
      }),
  );
});
