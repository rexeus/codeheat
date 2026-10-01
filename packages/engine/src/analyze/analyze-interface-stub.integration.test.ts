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

const stub = "packages/barrel/index.ts";
const real = "packages/barrel/src/index.ts";
const impl = "packages/barrel/src/impl.ts";
const apiTest = "packages/barrel/src/__tests__/api.ts";

layer(NodeServices.layer)("analyze interface of a barrel package", (it) => {
  it.effect(
    "blames the entry point that changed with the implementation, not the stub re-exporting it",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2024-01-01T12:00:00Z", {
          "packages/barrel/package.json": "{}\n",
          "packages/other/package.json": "{}\n",
          "packages/other/o.ts": "0\n",
          [stub]: "export * from './src/index'\n",
          [real]: "0\n",
          [impl]: "0\n",
          [apiTest]: "0\n",
        });
        // commits 1 to 5 change impl.ts and src/index.ts; 6 only the test in __tests__
        for (const number of [1, 2, 3, 4, 5]) {
          yield* repo.commit(day(number), {
            [impl]: `${number}\n`,
            [real]: `${number}\n`,
          });
        }
        yield* repo.commit(day(6), { [apiTest]: "6\n" });
        yield* repo.commit(day(7), { "packages/other/o.ts": "7\n" });

        const report = yield* analyze(analyzeOptionsFor(repo));

        const barrel = report.modules.find(
          (module) => module.path === "packages/barrel",
        );
        // the commit changing only __tests__/api.ts is no implementation commit: 5 of 5 leaked
        assert.deepStrictEqual(
          [
            barrel?.entryPoints,
            barrel?.interfaceCommits,
            barrel?.implementationCommits,
            barrel?.leakage,
            barrel?.leakyInterface,
          ],
          [[stub, real], 5, 5, 1, true],
        );
        const reasonsOf = (path: string) =>
          report.files.find((file) => file.path === path)?.reasons ?? [];
        assert.strictEqual(
          reasonsOf(real).at(-1),
          "interface changed in 100% of its module's implementation commits",
        );
        assert.isFalse(
          reasonsOf(stub).some((reason) =>
            reason.startsWith("interface changed"),
          ),
        );
      }),
  );
});
