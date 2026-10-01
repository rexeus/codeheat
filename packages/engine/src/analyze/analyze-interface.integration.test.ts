import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const stableIndex = "packages/stable/src/index.ts";
const [stableA, stableB, stableTest] = [
  "packages/stable/src/a.ts",
  "packages/stable/src/b.ts",
  "packages/stable/src/a.test.ts",
];
const leakyIndex = "packages/leaky/src/index.ts";
const [leakyX, leakyY] = ["packages/leaky/src/x.ts", "packages/leaky/src/y.ts"];
const plain = "packages/plain/util.ts";

/**
 * `stable` exports src/index.ts; `leaky` has main in dist/ with a src twin;
 * `plain` has no entry point. Counted commits (the setup commit predates the window):
 *
 * stable: 1 a, 2 b, 3 a + a.test, 4 a.test, 5 index, 6 a + b, 7 b; commit 4
 *   is neither interface nor implementation, commit 5 is interface only
 * leaky: 8 x + index, 9 x + index, 10 y, 11 x + y + index, 12 x, 13 only index,
 *   14 x + plain, 15 y + index + plain
 * plain: 14, 15, 16
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2024-01-01T12:00:00Z", {
      "packages/stable/package.json":
        '{ "exports": { ".": { "import": "./src/index.ts" } } }\n',
      "packages/leaky/package.json": '{ "main": "./dist/index.js" }\n',
      "packages/plain/package.json": "{}\n",
      [stableIndex]: "0\n",
      [stableA]: "0\n",
      [stableB]: "0\n",
      [stableTest]: "0\n",
      [leakyIndex]: "0\n",
      [leakyX]: "0\n",
      [leakyY]: "0\n",
      [plain]: "0\n",
    });
    const change = (number: number, ...files: ReadonlyArray<string>) =>
      repo.commit(
        day(number),
        Object.fromEntries(files.map((file) => [file, `${number}\n`])),
      );
    yield* change(1, stableA);
    yield* change(2, stableB);
    yield* change(3, stableA, stableTest);
    yield* change(4, stableTest);
    yield* change(5, stableIndex);
    yield* change(6, stableA, stableB);
    yield* change(7, stableB);
    yield* change(8, leakyX, leakyIndex);
    yield* change(9, leakyX, leakyIndex);
    yield* change(10, leakyY);
    yield* change(11, leakyX, leakyY, leakyIndex);
    yield* change(12, leakyX);
    yield* change(13, leakyIndex);
    yield* change(14, leakyX, plain);
    yield* change(15, leakyY, leakyIndex, plain);
    yield* change(16, plain);
  });

layer(NodeServices.layer)("analyze interface churn", (it) => {
  it.effect(
    "separates a stable interface from one that changes with its implementation",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        const churn = new Map(
          report.modules.map((module) => [
            module.path,
            [
              module.entryPoints,
              module.interfaceCommits,
              module.implementationCommits,
              module.leakage,
            ],
          ]),
        );
        // leaky: 4 of its 7 implementation commits (8, 9, 11, 15) also touched index.ts
        assert.deepStrictEqual(Object.fromEntries(churn), {
          "packages/stable": [[stableIndex], 1, 5, 0],
          "packages/leaky": [[leakyIndex], 5, 7, 0.5714],
          "packages/plain": [[], 0, 3, null],
        });
      }),
  );
});

layer(NodeServices.layer)("analyze interface reasons", (it) => {
  it.effect("explains only the leaky module's entry point", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* buildHistory(repo);

      const report = yield* analyze(analyzeOptionsFor(repo));

      const reasonsOf = (path: string) =>
        report.files.find((file) => file.path === path)?.reasons ?? [];
      assert.strictEqual(
        reasonsOf(leakyIndex).at(-1),
        "interface changed in 57% of its module's implementation commits",
      );
      assert.isFalse(
        reasonsOf(stableIndex).some((reason) =>
          reason.startsWith("interface changed"),
        ),
      );
      assert.isFalse(
        reasonsOf(leakyX).some((reason) =>
          reason.startsWith("interface changed"),
        ),
      );
    }),
  );
});

layer(NodeServices.layer)("analyze --entry", (it) => {
  it.effect("lets --entry globs replace the detected entry points", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* buildHistory(repo);

      const report = yield* analyze(
        analyzeOptionsFor(repo, { entry: ["packages/leaky/src/x.ts"] }),
      );

      const leaky = report.modules.find(
        (module) => module.path === "packages/leaky",
      );
      const stable = report.modules.find(
        (module) => module.path === "packages/stable",
      );
      // x.ts changed in commits 8, 9, 11, 12, 14. Implementation is then index.ts
      // and y.ts: 8, 9, 10, 11, 13, 15, of which 8, 9, 11 also touched x.ts.
      assert.deepStrictEqual(
        [
          leaky?.entryPoints,
          leaky?.interfaceCommits,
          leaky?.implementationCommits,
          leaky?.leakage,
          stable?.entryPoints,
          stable?.leakage,
        ],
        [[leakyX], 5, 6, 0.5, [], null],
      );
    }),
  );
});
