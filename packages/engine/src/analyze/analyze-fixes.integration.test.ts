import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import {
  commitInMonth,
  createTwoPackages,
  FILE_A,
  FILE_B,
} from "../testing/quarters.js";
import type { Change } from "../testing/quarters.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const changing = (
  count: number,
  message: string,
  ...files: ReadonlyArray<string>
): ReadonlyArray<Change> =>
  Array.from({ length: count }, () => ({ files, message }));

const analyzeCommits = (changes: ReadonlyArray<Change>) =>
  Effect.gen(function* () {
    yield* setNow;
    const repo = yield* makeTempRepository;
    yield* createTwoPackages(repo);
    yield* commitInMonth(repo, "2026-04", changes);
    return yield* analyze(analyzeOptionsFor(repo));
  });

layer(NodeServices.layer)("analyze fix density", (it) => {
  it.effect(
    "counts the fixes among the changes of each module, and the fixes that span modules",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeCommits([
          ...changing(6, "fix(a): crash on empty input", FILE_A),
          ...changing(2, "Fix the shared parser", FILE_A, FILE_B),
          ...changing(8, "feat: add the export", FILE_B),
        ]);

        assert.deepStrictEqual(report.fixDensity, {
          changes: 16,
          fixes: 8,
          conventional: 1,
          known: true,
          share: 0.5,
        });
        assert.deepStrictEqual(
          Object.fromEntries(
            report.modules.map(({ path, fixDensity }) => [path, fixDensity]),
          ),
          {
            "packages/a": { fixes: 8, share: 1, spanning: 2 },
            "packages/b": { fixes: 2, share: 0.2, spanning: 2 },
          },
        );
      }),
  );

  it.effect(
    "says the fix density is unknown, not 0, for a team without commit conventions",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeCommits([
          ...changing(10, "tweak the parser", FILE_A),
          ...changing(10, "more work on the export", FILE_B),
        ]);

        assert.deepStrictEqual(report.fixDensity, {
          changes: 20,
          fixes: 0,
          conventional: 0,
          known: false,
          share: null,
        });
        assert.deepStrictEqual(
          report.modules.map(({ fixDensity }) => fixDensity),
          [null, null],
        );
      }),
  );

  it.effect("reads a team that fixes in free text by the word fix", () =>
    Effect.gen(function* () {
      const report = yield* analyzeCommits([
        ...changing(3, "Fix the crash", FILE_A),
        ...changing(7, "Rework the export", FILE_A),
      ]);

      assert.strictEqual(report.fixDensity.known, true);
      assert.strictEqual(report.fixDensity.share, 0.3);
    }),
  );
});
