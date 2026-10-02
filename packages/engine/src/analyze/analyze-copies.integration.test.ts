import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

/**
 * Eight statements of four words each (32 words, 28 distinct runs of five).
 * The one word that `owner` fills is the only difference between two copies:
 * it breaks the 5 runs around it, so two copies share 23 of 33 runs.
 * A comment is no word, so `revision` changes the file and not its similarity.
 */
const handler = (owner: string, revision: number): string =>
  [
    ...Array.from(
      { length: 8 },
      (_, index) =>
        `export const ${index === 3 ? owner : `step${index}`} = value${index};`,
    ),
    `// revision ${revision}`,
  ].join("\n");

/** Eight statements that share no run of five words with `handler`. */
const settings = (revision: number): string =>
  [
    ...Array.from(
      { length: 8 },
      (_, index) => `let option${index} := choice${index};`,
    ),
    `// revision ${revision}`,
  ].join("\n");

const COPIES = [
  "src/billing/handler.ts",
  "src/orders/handler.ts",
  "src/users/handler.ts",
];

layer(NodeServices.layer)("analyze copy families", (it) => {
  it.effect(
    "groups near-identical files in different directories that change together and leaves a dissimilar coupled file out",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        for (let revision = 1; revision <= 4; revision += 1) {
          yield* repo.commit(day(revision), {
            "src/billing/handler.ts": handler("billing", revision),
            "src/orders/handler.ts": handler("orders", revision),
            "src/users/handler.ts": handler("users", revision),
            "src/shared/settings.ts": settings(revision),
          });
        }
        yield* repo.commit(day(5), {
          "src/orders/handler.ts": handler("orders", 5),
          "src/users/handler.ts": handler("users", 5),
        });

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(report.copyFamilies, [
          {
            files: COPIES,
            similarity: { min: 0.697, max: 0.697 },
            sharedChanges: 5,
            changesToAll: 4,
          },
        ]);
        assert.strictEqual(report.thresholds.minCopySimilarity, 0.5);
      }),
  );
});

layer(NodeServices.layer)("analyze copy family exclusions", (it) => {
  it.effect(
    "finds no family among similar files that never change together",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(day(1), {
          "src/billing/handler.ts": handler("billing", 0),
          "src/orders/handler.ts": handler("orders", 0),
        });
        for (let revision = 1; revision <= 4; revision += 1) {
          yield* repo.commit(day(revision + 1), {
            "src/billing/handler.ts": handler("billing", revision),
          });
          yield* repo.commit(day(revision + 10), {
            "src/orders/handler.ts": handler("orders", revision),
          });
        }

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(report.couplings, []);
        assert.deepStrictEqual(report.copyFamilies, []);
      }),
  );

  it.effect("does not call a file and its own test a family", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      for (let revision = 1; revision <= 4; revision += 1) {
        yield* repo.commit(day(revision), {
          "src/handler.ts": handler("orders", revision),
          "src/handler.test.ts": handler("orders", revision),
        });
      }

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(
        report.couplings.map(({ testPair }) => testPair),
        [true],
      );
      assert.deepStrictEqual(report.copyFamilies, []);
    }),
  );

  it.effect("leaves out a file too small to compare", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      for (let revision = 1; revision <= 4; revision += 1) {
        yield* repo.commit(day(revision), {
          "src/a.ts": `export * from "./shared";\n// revision ${revision}\n`,
          "src/b.ts": `export * from "./shared";\n// revision ${revision}\n`,
        });
      }

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(report.couplings.length, 1);
      assert.deepStrictEqual(report.copyFamilies, []);
    }),
  );
});
