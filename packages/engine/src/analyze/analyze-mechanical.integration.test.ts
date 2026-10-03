import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const code = (indent: string, extra = "") =>
  Array.from(
    { length: 10 },
    (_, index) => `${indent}const value${index} = ${index};\n`,
  ).join("") + extra;

/** Three commits that only change the indentation of c.ts and d.ts, back and forth. */
const commitReindents = (repo: TempRepository) =>
  Effect.gen(function* () {
    for (const [day, indent] of [
      ["04", "    "],
      ["05", "  "],
      ["06", "    "],
    ] as const) {
      yield* repo.commit(`2026-05-${day}T12:00:00Z`, {
        "c.ts": code(indent),
        "d.ts": code(indent),
      });
    }
  });

layer(NodeServices.layer)("analyze mechanical commits", (it) => {
  it.effect(
    "counts them in the window and per kind, but gives them no revisions or coupling",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-05-01T12:00:00Z", {
          "a.ts": code("  "),
          "b.ts": code("  "),
          "c.ts": code("  "),
          "d.ts": code("  "),
        });
        yield* repo.commit("2026-05-02T12:00:00Z", {
          "a.ts": code("  ", "// 1\n"),
          "b.ts": code("  ", "// 1\n"),
        });
        yield* repo.commit("2026-05-03T12:00:00Z", {
          "a.ts": code("  ", "// 1\n// 2\n"),
          "b.ts": code("  ", "// 1\n// 2\n"),
        });
        yield* commitReindents(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.strictEqual(report.window.commits, 6);
        assert.strictEqual(report.window.couplingCommits, 3);
        assert.deepStrictEqual(report.mechanicalCommits, {
          ignored: 0,
          renames: 0,
          whitespace: 3,
          reverts: 0,
          duplicates: 0,
        });
        assert.deepStrictEqual(
          report.couplings.map(({ a, b, sharedCommits }) => [
            a,
            b,
            sharedCommits,
          ]),
          [["a.ts", "b.ts", 3]],
        );
        const revisions = Object.fromEntries(
          report.files.map(({ path, revisions: count }) => [path, count]),
        );
        assert.deepStrictEqual(revisions, {
          "a.ts": 3,
          "b.ts": 3,
          "c.ts": 1,
          "d.ts": 1,
        });
      }),
  );
});

layer(NodeServices.layer)("analyze without mechanical commits", (it) => {
  it.effect("reports zero of every kind for a repository without any", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-05-01T12:00:00Z", { "a.ts": code("") });

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(report.mechanicalCommits, {
        ignored: 0,
        renames: 0,
        whitespace: 0,
        reverts: 0,
        duplicates: 0,
      });
    }),
  );
});
