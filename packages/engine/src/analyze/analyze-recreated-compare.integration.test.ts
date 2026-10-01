import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

// `--compare 3m` splits at 2026-03-01T12:00Z: the latest window is Mar to Jun 1, the previous one Dec to Mar 1.
const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

/**
 * a.ts is deleted in the previous window and recreated in the latest one,
 * b.ts is deleted and recreated within the latest one; c.ts is never deleted.
 *
 * previous window                    latest window
 * P1-P3 a, b, c edited               C1 rm b
 * P4 rm a                            C2 b created
 *                                    C3 a created
 *                                    C4 a, b, c edited
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2025-11-01T12:00:00Z", {
      "a.ts": "0\n",
      "b.ts": "0\n",
      "c.ts": "0\n",
    });
    for (const [date, version] of [
      ["2025-12-10", 1],
      ["2025-12-20", 2],
      ["2026-01-10", 3],
    ] as const) {
      yield* repo.commit(`${date}T12:00:00Z`, {
        "a.ts": `${version}\n`,
        "b.ts": `${version}\n`,
        "c.ts": `${version}\n`,
      });
    }
    yield* repo.git("rm", "a.ts");
    yield* repo.commit("2026-02-10T12:00:00Z");
    yield* repo.git("rm", "b.ts");
    yield* repo.commit("2026-04-01T12:00:00Z");
    yield* repo.commit("2026-04-05T12:00:00Z", { "b.ts": "5\n" });
    yield* repo.commit("2026-04-10T12:00:00Z", { "a.ts": "5\n" });
    yield* repo.commit("2026-05-10T12:00:00Z", {
      "a.ts": "6\n",
      "b.ts": "6\n",
      "c.ts": "6\n",
    });
  });

const recreated = {
  previousScore: 0,
  previousRevisions: 0,
  scoreDelta: 1,
  newlyActive: true,
};

// latest revisions: a 2, b 2, c 1 -> 1, 1, ln2/ln3 = 0.6309
// previous revisions of the files that exist today: a 0, b 0, c 3 -> 0, 0, 1
const expectedTrends = [
  ["a.ts", 1, recreated],
  ["b.ts", 1, recreated],
  [
    "c.ts",
    0.6309,
    {
      previousScore: 1,
      previousRevisions: 3,
      scoreDelta: -0.3691,
      newlyActive: false,
    },
  ],
];

layer(NodeServices.layer)("analyze --compare recreated paths", (it) => {
  it.effect(
    "judges a recreated file by its own revisions in both windows, never by the file deleted at its path",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(
          analyzeOptionsFor(repo, { compare: "3m" }),
        );

        assert.deepStrictEqual(
          report.files
            .toSorted((x, y) => x.path.localeCompare(y.path))
            .map(({ path, score, trend }) => [path, score, trend]),
          expectedTrends,
        );
      }),
  );

  it.effect(
    "counts the commits that only touched a deleted file in both windows",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(
          analyzeOptionsFor(repo, { compare: "3m" }),
        );

        assert.strictEqual(report.comparison?.previousCommits, 4);
        assert.strictEqual(report.window.commits, 4);
      }),
  );
});
