import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { lines } from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const manifest = (name: string): string => `{ "name": "${name}" }\n`;

/**
 * Four packages, one of them test-only (a package of test code alone). The
 * counted changes, with the modules they touched:
 *
 * 1: a    2: a    3: a and e2e (the test of the change)    4: b
 * 5: a and b    6: pull request #7, one commit in a and one in c: a and c
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2024-01-01T12:00:00Z", {
      "packages/a/package.json": manifest("a"),
      "packages/b/package.json": manifest("b"),
      "packages/c/package.json": manifest("c"),
      "packages/e2e/package.json": manifest("e2e"),
      "packages/a/a.ts": lines(3, "a"),
      "packages/b/b.ts": lines(3, "b"),
      "packages/c/c.ts": lines(3, "c"),
      "packages/e2e/a.test.ts": lines(3, "t"),
    });
    const a = "packages/a/a.ts";
    const b = "packages/b/b.ts";
    yield* repo.commit(day(1), { [a]: lines(4, "a") });
    yield* repo.commit(day(2), { [a]: lines(5, "a") });
    yield* repo.commit(day(3), {
      [a]: lines(6, "a"),
      "packages/e2e/a.test.ts": lines(4, "t"),
    });
    yield* repo.commit(day(4), { [b]: lines(4, "b") });
    yield* repo.commit(day(5), { [a]: lines(7, "a"), [b]: lines(5, "b") });
    yield* repo.commit(day(6), { [a]: lines(8, "a") }, "feat: split (#7)");
    yield* repo.commit(
      day(7),
      { "packages/c/c.ts": lines(4, "c") },
      "refactor: split (#7)",
    );
  });

layer(NodeServices.layer)("analyze change radius", (it) => {
  it.effect(
    "measures the modules a logical change touched, leaving test-only modules out",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.strictEqual(report.window.couplingCommits, 6);
        assert.deepStrictEqual(report.changeRadius, {
          changes: 6,
          median: 1,
          p90: 2,
          local: 0.6667,
        });
        assert.deepStrictEqual(
          Object.fromEntries(
            report.modules.map(({ path, radius }) => [path, radius]),
          ),
          {
            "packages/a": 1,
            "packages/b": 1,
            "packages/c": 2,
            "packages/e2e": null,
          },
        );
      }),
  );

  it.effect("has no radius without a counted change", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2024-01-01T12:00:00Z", { "a.ts": lines(3, "a") });

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(report.changeRadius, null);
      assert.deepStrictEqual(
        report.modules.map(({ radius }) => radius),
        [null],
      );
    }),
  );
});
