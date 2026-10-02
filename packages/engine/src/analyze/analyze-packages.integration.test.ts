import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

layer(NodeServices.layer)("analyze package detection", (it) => {
  it.effect(
    "detects a package whose tracked manifest matches a gitignore pattern",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(day(1), {
          "app/package.json": '{ "name": "app" }\n',
          "app/main.ts": "export const main = 1;\n",
          "scripts/package.json": '{ "name": "scripts" }\n',
          "scripts/run.ts": "export const run = 1;\n",
        });
        // ignored after the fact: the manifest stays tracked
        yield* repo.commit(day(2), { "scripts/.gitignore": "*.json\n" });
        yield* repo.commit(day(3), {
          "app/main.ts": "export const main = 2;\n",
          "scripts/run.ts": "export const run = 2;\n",
        });

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.modules.map(({ path, kind }) => [path, kind]),
          [
            ["app", "package"],
            ["scripts", "package"],
          ],
        );
      }),
  );
});
