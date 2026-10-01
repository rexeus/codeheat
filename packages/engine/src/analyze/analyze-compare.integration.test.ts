import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import type { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { InvalidCompare } from "./analysis-window.js";
import { analyze } from "./analyze.js";

// `--compare 3m` splits at 2026-03-01T12:00Z: the latest window is Mar to Jun 1, the previous one Dec to Mar 1.
const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const manifest = (name: string): string => `{ "name": "${name}" }\n`;

const hot = "packages/a/hot.ts";
const other = "packages/a/other.ts";
const b = "packages/b/b.ts";
const quiet = "packages/b/quiet.ts";
const fresh = "packages/a/fresh.ts";

/**
 * Every file stays one line, so each score is log(1 + revisions) over the
 * window's largest log(1 + revisions). Changes pile up early and calm down:
 *
 * previous window            latest window
 * P1 hot                     C1 hot     (exactly at the split: belongs to the latest window)
 * P2 hot                     C2 other, fresh (created here)
 * P3 hot, b                  C3 other
 * P4 hot, b
 * P5 other
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2025-11-01T12:00:00Z", {
      "packages/a/package.json": manifest("a"),
      "packages/b/package.json": manifest("b"),
      [hot]: "0\n",
      [other]: "0\n",
      [b]: "0\n",
      [quiet]: "0\n",
    });
    yield* repo.commit("2025-12-10T12:00:00Z", { [hot]: "1\n" });
    yield* repo.commit("2025-12-20T12:00:00Z", { [hot]: "2\n" });
    yield* repo.commit("2026-01-10T12:00:00Z", { [hot]: "3\n", [b]: "3\n" });
    yield* repo.commit("2026-01-20T12:00:00Z", { [hot]: "4\n", [b]: "4\n" });
    yield* repo.commit("2026-02-10T12:00:00Z", { [other]: "5\n" });
    yield* repo.commit("2026-03-01T12:00:00Z", { [hot]: "6\n" });
    yield* repo.commit("2026-04-10T12:00:00Z", {
      [other]: "7\n",
      [fresh]: "0\n",
    });
    yield* repo.commit("2026-05-10T12:00:00Z", { [other]: "8\n" });
  });

const moved = (previousScore: number, scoreDelta: number) => ({
  previousScore,
  scoreDelta,
  newlyActive: false,
});

const withoutTrends = (report: Report): Report => ({
  ...report,
  comparison: null,
  files: report.files.map((file) => Object.assign({}, file, { trend: null })),
  modules: report.modules.map((module) =>
    Object.assign({}, module, { trend: null }),
  ),
});

const compareOptions = (repo: TempRepository) =>
  analyzeOptionsFor(repo, { compare: "3m" });

layer(NodeServices.layer)("analyze --compare", (it) => {
  it.effect("names the previous window right before the latest one", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* buildHistory(repo);

      const report = yield* analyze(compareOptions(repo));

      assert.deepStrictEqual(report.comparison, {
        previousSince: "2025-12-01T12:00:00.000Z",
        previousUntil: "2026-03-01T12:00:00.000Z",
        previousCommits: 5,
        previousTruncated: false,
      });
      assert.strictEqual(report.window.since, "2026-03-01T12:00:00.000Z");
      assert.strictEqual(report.window.commits, 3);
    }),
  );
});

layer(NodeServices.layer)("analyze --compare file trends", (it) => {
  // previous revisions: hot 4, b 2, other 1 -> 1, ln3/ln5 = 0.6826, ln2/ln5 = 0.4307
  // latest revisions:   hot 1, other 2, fresh 1, b 0 -> ln2/ln3 = 0.6309, 1, 0.6309, 0
  // fresh has no previous revision, quiet none in either window
  it.effect("reports how each file's normalized score moved", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* buildHistory(repo);

      const report = yield* analyze(compareOptions(repo));

      assert.deepStrictEqual(
        report.files.map(({ path, score, trend }) => [path, score, trend]),
        [
          [other, 1, moved(0.4307, 0.5693)],
          [
            fresh,
            0.6309,
            { previousScore: 0, scoreDelta: 0.6309, newlyActive: true },
          ],
          [hot, 0.6309, moved(1, -0.3691)],
          [b, 0, moved(0.6826, -0.6826)],
          [quiet, 0, moved(0, 0)],
        ],
      );
    }),
  );

  // previous: a has 5 commits, 3 of them local (0.6); b has 2, none local (0)
  // latest:   a has 3 commits, all local (1); b has none
  it.effect(
    "reports how each module's cohesion moved and leaves a quiet module without trend",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(compareOptions(repo));

        assert.deepStrictEqual(
          report.modules.map(({ path, cohesion, trend }) => [
            path,
            cohesion,
            trend,
          ]),
          [
            ["packages/a", 1, { previousCohesion: 0.6, cohesionDelta: 0.4 }],
            ["packages/b", null, null],
          ],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze --compare against --since", (it) => {
  it.effect(
    "equals a --since report of the same length apart from the trends",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const compared = yield* analyze(compareOptions(repo));
        const since = yield* analyze(analyzeOptionsFor(repo, { since: "3m" }));

        assert.deepStrictEqual(withoutTrends(compared), since);
      }),
  );

  it.effect("leaves every trend null without --compare", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* buildHistory(repo);

      const report = yield* analyze(analyzeOptionsFor(repo, { since: "12m" }));

      assert.isNull(report.comparison);
      assert.isTrue(report.files.every((file) => file.trend === null));
      assert.isTrue(report.modules.every((module) => module.trend === null));
    }),
  );
});

layer(NodeServices.layer)("analyze --compare edge cases", (it) => {
  it.effect(
    "leaves file trends null and counts no commits when the previous window is quiet",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2025-11-01T12:00:00Z", { [hot]: "0\n" });
        yield* repo.commit("2026-04-10T12:00:00Z", { [hot]: "1\n" });

        const report = yield* analyze(compareOptions(repo));

        assert.deepStrictEqual(
          report.files.map((file) => file.trend),
          [null],
        );
        assert.strictEqual(report.comparison?.previousCommits, 0);
        assert.isFalse(report.comparison?.previousTruncated);
      }),
  );
});

layer(NodeServices.layer)(
  "analyze --compare against a young repository",
  (it) => {
    it.effect(
      "marks the previous window as truncated when the repository is younger than it",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-04-10T12:00:00Z", { [hot]: "0\n" });
          yield* repo.commit("2026-05-10T12:00:00Z", { [hot]: "1\n" });

          const report = yield* analyze(compareOptions(repo));

          assert.strictEqual(report.comparison?.previousCommits, 0);
          assert.isTrue(report.comparison?.previousTruncated);
        }),
    );

    it.effect(
      "compares a duration longer than the repository's age without data to compare",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-04-10T12:00:00Z", { [hot]: "0\n" });
          yield* repo.commit("2026-05-10T12:00:00Z", { [hot]: "1\n" });

          const report = yield* analyze(
            analyzeOptionsFor(repo, { compare: "15y" }),
          );

          assert.strictEqual(report.window.commits, 2);
          assert.deepStrictEqual(report.comparison, {
            previousSince: "1996-06-01T12:00:00.000Z",
            previousUntil: "2011-06-01T12:00:00.000Z",
            previousCommits: 0,
            previousTruncated: true,
          });
          assert.isNull(report.files[0]?.trend);
        }),
    );

    it.effect("rejects a compare value that is not a duration", () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;

        const failure = yield* Effect.flip(
          analyze(analyzeOptionsFor(repo, { compare: "2026-01-01" })),
        );

        assert.deepStrictEqual(
          failure,
          new InvalidCompare({ input: "2026-01-01" }),
        );
      }),
    );
  },
);
