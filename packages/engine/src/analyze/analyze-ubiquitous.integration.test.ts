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

/**
 * Twenty-four commits change `src/a.ts` and `src/b.ts` together.
 * `api/openapi.yaml` changes in twelve of them (50 %) and `api/orders.tsp` in
 * six (25 %).
 */
const centralContract = (repo: TempRepository) =>
  Effect.gen(function* () {
    for (let index = 1; index <= 24; index += 1) {
      yield* repo.commit(day(index), {
        "src/a.ts": `export const a = ${index}\n`,
        "src/b.ts": `export const b = ${index}\n`,
        ...(index % 2 === 0
          ? { "api/openapi.yaml": `version: ${index}\n` }
          : {}),
        ...(index % 4 === 0
          ? { "api/orders.tsp": `model A { n: ${index} }\n` }
          : {}),
      });
    }
  });

layer(NodeServices.layer)("analyze ubiquitous contract files", (it) => {
  it.effect(
    "reports a contract that changes in most commits apart and leaves it out of every pair",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* centralContract(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(report.ubiquitousFiles, [
          { path: "api/openapi.yaml", commits: 12, share: 0.5 },
        ]);
        assert.deepStrictEqual(
          report.couplings.map(({ a, b }) => [a, b]),
          [
            ["src/a.ts", "src/b.ts"],
            ["api/orders.tsp", "src/a.ts"],
            ["api/orders.tsp", "src/b.ts"],
          ],
        );
        assert.deepStrictEqual(
          report.contracts.map(({ path }) => path),
          ["api/openapi.yaml", "api/orders.tsp"],
        );
      }),
  );

  it.effect(
    "leaves a ubiquitous contract out of breadth and of module cohesion",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* centralContract(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        const breadths = new Map(
          report.files.map((file) => [file.path, file.breadth]),
        );
        // b.ts and orders.tsp; openapi.yaml is not counted
        assert.strictEqual(breadths.get("src/a.ts"), 2);
        // the six commits that changed orders.tsp (at the root, outside the module) are not local; the twelve openapi.yaml ones would not be either
        const [module] = report.modules;
        assert.deepStrictEqual(
          [module?.path, module?.commits, module?.cohesion],
          ["src", 24, 0.75],
        );
      }),
  );
});

layer(NodeServices.layer)(
  "analyze contract files below the ubiquity share",
  (it) => {
    it.effect("keeps a contract that changes in few commits in the pairs", () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* centralContract(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        // orders.tsp: 6 of the 24 commits, below the share of 30 %
        assert.isFalse(
          report.ubiquitousFiles.some(({ path }) => path === "api/orders.tsp"),
        );
        assert.isTrue(report.couplings.some(({ a }) => a === "api/orders.tsp"));
      }),
    );
  },
);
