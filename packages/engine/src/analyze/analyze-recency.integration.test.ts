import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import type { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";
import { InvalidHalfLife } from "./half-life.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

/**
 * Two one-line files. old.ts changed eight times in autumn 2024 (about 600
 * days before now), recent.ts four times in April and May 2026.
 */
const commitSetupPhaseAndRecentWork = (repo: TempRepository) =>
  Effect.gen(function* () {
    for (let index = 0; index < 8; index += 1) {
      yield* repo.commit(`2024-09-${String(index + 10)}T12:00:00Z`, {
        "old.ts": `${index}\n`,
      });
    }
    for (const [index, date] of [
      "2026-04-10",
      "2026-04-24",
      "2026-05-08",
      "2026-05-22",
    ].entries()) {
      yield* repo.commit(`${date}T12:00:00Z`, { "recent.ts": `${index}\n` });
    }
  });

const order = (report: Report) => report.files.map(({ path }) => path);

layer(NodeServices.layer)("analyze recency weighting", (it) => {
  it.effect(
    "ranks a recently changed file above an old one with more revisions",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitSetupPhaseAndRecentWork(repo);

        const weighted = yield* analyze(
          analyzeOptionsFor(repo, { since: "2y", halfLife: "6m" }),
        );
        const unweighted = yield* analyze(
          analyzeOptionsFor(repo, { since: "2y", halfLife: "0" }),
        );

        assert.deepStrictEqual(order(unweighted), ["old.ts", "recent.ts"]);
        assert.deepStrictEqual(order(weighted), ["recent.ts", "old.ts"]);
        assert.deepStrictEqual(
          weighted.files.map(({ revisions }) => revisions),
          [4, 8],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze half-life values", (it) => {
  it.effect("weighs revisions 0.5 for each half-life of age", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      // exactly 0, 30, and 60 days before now
      yield* repo.commit("2026-04-02T12:00:00Z", { "a.ts": "0\n" });
      yield* repo.commit("2026-05-02T12:00:00Z", { "a.ts": "1\n" });
      yield* repo.commit("2026-05-31T12:00:00Z", { "b.ts": "0\n" });

      const report = yield* analyze(
        analyzeOptionsFor(repo, { halfLife: "30d" }),
      );

      // a: 60 and 30 days old (0.25 + 0.5); b: one day old, 0.5^(1/30)
      assert.deepStrictEqual(
        report.files.map(({ path, revisions, weightedRevisions }) => [
          path,
          revisions,
          weightedRevisions,
        ]),
        [
          ["b.ts", 1, 0.9772],
          ["a.ts", 2, 0.75],
        ],
      );
      assert.strictEqual(report.thresholds.halfLifeDays, 30);
    }),
  );

  it.effect("weighs every change 1 and reports half-life 0 when disabled", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitSetupPhaseAndRecentWork(repo);

      const report = yield* analyze(
        analyzeOptionsFor(repo, { since: "2y", halfLife: "0" }),
      );

      assert.deepStrictEqual(
        report.files.map(({ revisions, weightedRevisions }) => [
          revisions,
          weightedRevisions,
        ]),
        [
          [8, 8],
          [4, 4],
        ],
      );
      assert.strictEqual(report.thresholds.halfLifeDays, 0);
    }),
  );
});

layer(NodeServices.layer)("analyze half-life inputs", (it) => {
  it.effect("uses a half-life of six months (180 days) by default", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-04-02T12:00:00Z", { "a.ts": "0\n" });

      const report = yield* analyze(
        analyzeOptionsFor(repo, { halfLife: undefined }),
      );

      assert.strictEqual(report.thresholds.halfLifeDays, 180);
    }),
  );

  it.effect("fails with InvalidHalfLife for a value it cannot read", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-04-02T12:00:00Z", { "a.ts": "0\n" });

      const error = yield* Effect.flip(
        analyze(analyzeOptionsFor(repo, { halfLife: "soon" })),
      );

      assert.deepStrictEqual(error, new InvalidHalfLife({ input: "soon" }));
    }),
  );
});

layer(NodeServices.layer)("analyze --compare recency weighting", (it) => {
  it.effect("weighs each window from its own end", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      // `--compare 3m` splits at 2026-03-01T12:00Z: p.ts changed 30 days and q.ts 60 days before it
      yield* repo.commit("2025-12-31T12:00:00Z", { "q.ts": "0\n" });
      yield* repo.commit("2026-01-30T12:00:00Z", { "p.ts": "0\n" });
      yield* repo.commit("2026-05-31T12:00:00Z", { "r.ts": "0\n" });

      const report = yield* analyze(
        analyzeOptionsFor(repo, { compare: "3m", halfLife: "30d" }),
      );

      // previous weights 0.5 (p) and 0.25 (q); ln(1.25) / ln(1.5) = 0.5503
      const previous = Object.fromEntries(
        report.files.map(({ path, trend }) => [path, trend?.previousScore]),
      );
      assert.deepStrictEqual(previous, {
        "p.ts": 1,
        "q.ts": 0.5503,
        "r.ts": 0,
      });
    }),
  );
});
