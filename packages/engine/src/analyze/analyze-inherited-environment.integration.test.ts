import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { setScopedEnv } from "../testing/scoped-env.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

layer(NodeServices.layer)("analyze with inherited git variables", (it) => {
  it.effect(
    "analyzes the given directory when GIT_DIR names another repository",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));
        const target = yield* makeTempRepository;
        yield* target.commit("2026-05-01T12:00:00Z", { "target.ts": "a();\n" });
        const surrounding = yield* makeTempRepository;
        yield* surrounding.commit("2026-05-01T12:00:00Z", {
          "surrounding.ts": "b();\n",
        });
        yield* setScopedEnv({
          GIT_DIR: `${surrounding.directory}/.git`,
          GIT_WORK_TREE: surrounding.directory,
        });

        const report = yield* analyze(analyzeOptionsFor(target));

        assert.deepStrictEqual(
          report.files.map((file) => file.path),
          ["target.ts"],
        );
      }),
  );
});
