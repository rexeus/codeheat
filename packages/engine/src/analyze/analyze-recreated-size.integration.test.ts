import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const steady = Array.from({ length: 49 }, (_, index) => `f${index + 1}.ts`);

const version = (number: number, files: ReadonlyArray<string>) =>
  Object.fromEntries(files.map((file) => [file, `${number}\n`]));

layer(NodeServices.layer)("analyze mass commits of recreated paths", (it) => {
  // Three commits touch 51 files: f1..f49 and d1, d2. Then d1 and d2 are
  // deleted and created again, so the two files change in no commit that is
  // small enough to count, however few of the 51 files exist as they were.
  it.effect(
    "ignores a commit for coupling by every file it touched, not by those that still have their history",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        const files = [...steady, "d1.ts", "d2.ts"];
        for (const number of [1, 2, 3]) {
          yield* repo.commit(
            `2026-05-0${number}T12:00:00Z`,
            version(number, files),
          );
        }
        yield* repo.git("rm", "d1.ts", "d2.ts");
        yield* repo.commit("2026-05-04T12:00:00Z");
        yield* repo.commit(
          "2026-05-05T12:00:00Z",
          version(5, ["d1.ts", "d2.ts"]),
        );

        const report = yield* analyze(analyzeOptionsFor(repo));

        // the deletion and the creation of d1 and d2 are the only small commits
        assert.strictEqual(report.window.commits, 5);
        assert.strictEqual(report.window.couplingCommits, 2);
        assert.deepStrictEqual(report.couplings, []);
        assert.strictEqual(
          report.files.find(({ path }) => path === "f1.ts")?.breadth,
          0,
        );
      }),
  );
});
