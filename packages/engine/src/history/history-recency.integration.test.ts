import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory, readHistoryHalves } from "./history.js";
import type { History, HistoryOptions } from "./history.js";

const options = (
  universe: ReadonlyArray<string>,
  halfLifeDays: number | undefined,
): HistoryOptions => ({
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-04-01T12:00:00.000Z",
  skipCommits: new Set(),
  universe: new Set(universe),
  halfLifeDays,
});

/** The weights of a history's changes, newest first (a weight falls with age). */
const weightsOf = ({ changes }: History): ReadonlyArray<number> =>
  changes.map(({ weight }) => weight).toSorted((a, b) => b - a);

/** a.ts changes 60 and 30 days and then, with b.ts, 0 days before 2026-04-01T12:00Z, the end of the window. */
const commitAtThreeAges = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-01-31T12:00:00Z", { "a.ts": "0\n" });
    yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "1\n" });
    yield* repo.commit("2026-04-01T12:00:00Z", {
      "a.ts": "2\n",
      "b.ts": "0\n",
    });
  });

layer(NodeServices.layer)("readHistory recency weights", (it) => {
  it.effect("weighs each commit by its age at the end of the window", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitAtThreeAges(repo);

      const result = yield* readHistory(options(["a.ts", "b.ts"], 30)).pipe(
        Effect.provide(Git.layer(repo.directory)),
      );

      assert.deepStrictEqual(weightsOf(result), [1, 0.5, 0.25]);
      assert.deepStrictEqual(
        [
          result.files.get("a.ts")?.revisions,
          result.files.get("a.ts")?.weightedRevisions,
          result.files.get("b.ts")?.revisions,
          result.files.get("b.ts")?.weightedRevisions,
        ],
        [3, 1.75, 1, 1],
      );
    }),
  );

  it.effect("weighs every commit 1 without a half-life or with 0", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitAtThreeAges(repo);

      const weights = yield* Effect.forEach([undefined, 0], (halfLifeDays) =>
        readHistory(options(["a.ts", "b.ts"], halfLifeDays)).pipe(
          Effect.map(weightsOf),
          Effect.provide(Git.layer(repo.directory)),
        ),
      );

      assert.deepStrictEqual(weights, [
        [1, 1, 1],
        [1, 1, 1],
      ]);
    }),
  );
});

layer(NodeServices.layer)("readHistoryHalves recency weights", (it) => {
  it.effect("weighs each half from its own end", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitAtThreeAges(repo);

      // the split lies 30 days before the end: 2026-03-02T12:00Z
      const { recent, earlier } = yield* readHistoryHalves(
        options(["a.ts", "b.ts"], 30),
        Date.parse("2026-03-02T12:00:00Z") / 1000,
      ).pipe(Effect.provide(Git.layer(repo.directory)));

      // recent: 0 and 30 days before the end; earlier: 30 days before its end, the split
      assert.deepStrictEqual(weightsOf(recent), [1, 0.5]);
      assert.deepStrictEqual(weightsOf(earlier), [0.5]);
      assert.strictEqual(recent.files.get("a.ts")?.weightedRevisions, 1.5);
      assert.strictEqual(earlier.files.get("a.ts")?.weightedRevisions, 0.5);
    }),
  );
});

layer(NodeServices.layer)("readHistory weights of logical changes", (it) => {
  it.effect(
    "weighs a change like its newest commit, and its files' revisions like each commit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        // one pull request, two commits 20 and 10 days before the end: weights 0.25 and 0.5 at a half-life of 10 days
        yield* repo.commit(
          "2026-03-12T12:00:00Z",
          { "a.ts": "0\n" },
          "feat: start (#12)",
        );
        yield* repo.commit(
          "2026-03-22T12:00:00Z",
          { "a.ts": "1\n" },
          "feat: finish (#12)",
        );

        const result = yield* readHistory(options(["a.ts"], 10)).pipe(
          Effect.provide(Git.layer(repo.directory)),
        );

        assert.deepStrictEqual(weightsOf(result), [0.5]);
        assert.deepStrictEqual(result.files.get("a.ts"), {
          revisions: 2,
          weightedRevisions: 0.75,
          changes: 1,
          weightedChanges: 0.5,
          linesAdded: 2,
          linesDeleted: 1,
        });
      }),
  );
});
