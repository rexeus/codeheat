import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

layer(NodeServices.layer)("analyze recreated paths", (it) => {
  it.effect(
    "counts the revisions and coupling partners of the file that exists today, not of the one deleted at its path",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        // the dead a.ts changes with shared.ts in three commits
        for (const version of [1, 2, 3]) {
          yield* repo.commit(`2026-05-0${version}T12:00:00Z`, {
            "a.ts": `${version}\n`,
            "shared.ts": `${version}\n`,
          });
        }
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-05-04T12:00:00Z");
        // the new a.ts changes with fresh.ts in three commits
        for (const version of [5, 6, 7]) {
          yield* repo.commit(`2026-05-0${version}T12:00:00Z`, {
            "a.ts": `${version}\n`,
            "fresh.ts": `${version}\n`,
          });
        }

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.files
            .toSorted((x, y) => x.path.localeCompare(y.path))
            .map(({ path, revisions }) => [path, revisions]),
          [
            ["a.ts", 3],
            ["fresh.ts", 3],
            ["shared.ts", 3],
          ],
        );
        assert.deepStrictEqual(
          report.couplings.map(({ a, b, sharedCommits }) => [
            a,
            b,
            sharedCommits,
          ]),
          [["a.ts", "fresh.ts", 3]],
        );
        assert.strictEqual(report.window.commits, 7);
      }),
  );
});
