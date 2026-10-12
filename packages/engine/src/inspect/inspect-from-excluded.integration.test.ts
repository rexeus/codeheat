import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyze } from "../analyze/analyze.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { inspectFrom } from "./inspect-from.js";

/** Code and data below `test/`, which a default pattern leaves out, beside `src/a.ts`. */
const makeProject = Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-05-01T12:00:00Z", {
    "src/a.ts": "a\n",
    "test/a.ts": "a\n",
    "test/data.json": "{}\n",
  });
  return { repo, report: yield* analyze(analyzeOptionsFor(repo)) };
});

layer(NodeServices.layer)("inspectFrom excluded files", (it) => {
  it.effect(
    "names the pattern for a code file it left out, and not for a data file that is no code",
    () =>
      Effect.gen(function* () {
        const { repo, report } = yield* makeProject;

        const result = yield* inspectFrom({
          cwd: repo.directory,
          report,
          patterns: ["test/a.ts", "test/data.json"],
          include: [],
        });

        assert.deepStrictEqual(result.excluded, [
          { path: "test/a.ts", pattern: "**/test/**", source: "default" },
        ]);
        assert.deepStrictEqual(result.unmatched, ["test/data.json"]);
      }),
  );

  it.effect("looks for excluded files among those the include globs name", () =>
    Effect.gen(function* () {
      const { repo, report } = yield* makeProject;

      const result = yield* inspectFrom({
        cwd: repo.directory,
        report,
        patterns: ["test/data.json"],
        include: ["**/*.json"],
      });

      assert.deepStrictEqual(result.excluded, [
        { path: "test/data.json", pattern: "**/test/**", source: "default" },
      ]);
    }),
  );
});
