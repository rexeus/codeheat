import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { lines } from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

layer(NodeServices.layer)("analyze logical changes of pull requests", (it) => {
  it.effect(
    "couples files that three pull requests (and a first commit) changed in separate commits, and keeps revisions per commit",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-01-01T12:00:00Z", {
          "a.ts": lines(3, "a"),
          "b.ts": lines(3, "b"),
        });
        for (const pr of [1, 2, 3]) {
          const day = `2026-03-0${pr}`;
          yield* repo.commit(
            `${day}T10:00:00Z`,
            { "a.ts": lines(3 + pr, "a") },
            `feat: logic (#${pr})`,
          );
          yield* repo.commit(
            `${day}T11:00:00Z`,
            { "b.ts": lines(3 + pr, "b") },
            `test: cover it (#${pr})`,
          );
        }

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(report.logicalChanges, {
          by: "pr",
          count: 4,
          largest: 2,
        });
        assert.strictEqual(report.window.realCommits, 7);
        assert.strictEqual(report.window.couplingCommits, 4);
        assert.deepStrictEqual(
          report.couplings.map(({ a, b, sharedCommits }) => [
            a,
            b,
            sharedCommits,
          ]),
          [["a.ts", "b.ts", 4]],
        );
        assert.deepStrictEqual(
          report.files.map(({ path, revisions }) => [path, revisions]),
          [
            ["a.ts", 4],
            ["b.ts", 4],
          ],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze logical changes without a signal", (it) => {
  it.effect(
    "counts every commit as a change without a signal to group by",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": lines(3, "a") });
        yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": lines(4, "a") });

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(report.logicalChanges, {
          by: "commit",
          count: 2,
          largest: 1,
        });
        assert.strictEqual(report.window.couplingCommits, 2);
      }),
  );
});

layer(NodeServices.layer)("analyze logical changes without history", (it) => {
  it.effect("reports no changes for a repository without commits", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(report.logicalChanges, {
        by: "commit",
        count: 0,
        largest: 0,
      });
    }),
  );
});
