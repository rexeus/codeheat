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

layer(NodeServices.layer)("analyze logical changes too large", (it) => {
  it.effect(
    "adds neither changes nor heat to the files of a change of 51 files",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        const bulk = Array.from(
          { length: 50 },
          (_, index) => `bulk/b${index}.ts`,
        );
        yield* repo.commit(
          "2025-01-01T12:00:00Z",
          Object.fromEntries(
            ["src/a.ts", ...bulk].map((path) => [path, lines(3, path)]),
          ),
        );
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "src/a.ts": lines(4, "a"),
        });
        yield* repo.commit(
          "2026-03-02T12:00:00Z",
          Object.fromEntries(
            ["src/a.ts", ...bulk].map((path) => [path, lines(5, path)]),
          ),
        );

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.files
            .filter(({ path }) => path === "src/a.ts" || path === "bulk/b0.ts")
            .map(({ path, revisions, changes }) => [path, revisions, changes]),
          [
            ["src/a.ts", 2, 1],
            ["bulk/b0.ts", 1, 0],
          ],
        );
        assert.deepStrictEqual(
          Object.fromEntries(
            report.territories.nodes
              .filter(({ path }) => path === "src" || path === "bulk")
              .map(({ path, changes, heatShare }) => [
                path,
                { changes, heatShare },
              ]),
          ),
          {
            bulk: { changes: 0, heatShare: 0 },
            src: { changes: 1, heatShare: 1 },
          },
        );
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

layer(NodeServices.layer)(
  "analyze logical changes as the unit of ratios",
  (it) => {
    it.effect(
      "measures degree and probability against the changes of a file, not its commits",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2025-01-01T12:00:00Z", {
            "a.ts": lines(3, "a"),
            "b.ts": lines(3, "b"),
          });
          // pull request 1: three commits of a.ts, one of them also of b.ts
          yield* repo.commit(
            "2026-03-01T10:00:00Z",
            { "a.ts": lines(4, "a") },
            "feat: one (#1)",
          );
          yield* repo.commit(
            "2026-03-01T11:00:00Z",
            { "a.ts": lines(5, "a"), "b.ts": lines(4, "b") },
            "feat: two (#1)",
          );
          yield* repo.commit(
            "2026-03-01T12:00:00Z",
            { "a.ts": lines(6, "a") },
            "feat: three (#1)",
          );
          for (const pr of [2, 3]) {
            yield* repo.commit(
              `2026-03-0${pr}T12:00:00Z`,
              { "a.ts": lines(6 + pr, "a"), "b.ts": lines(4 + pr, "b") },
              `feat: more (#${pr})`,
            );
          }

          const report = yield* analyze(analyzeOptionsFor(repo));

          assert.deepStrictEqual(
            report.files.map(({ path, revisions, changes }) => [
              path,
              revisions,
              changes,
            ]),
            [
              ["a.ts", 5, 3],
              ["b.ts", 3, 3],
            ],
          );
          const [pair] = report.couplings;
          assert.deepStrictEqual([pair?.sharedCommits, pair?.degree], [3, 1]);
        }),
    );
  },
);
