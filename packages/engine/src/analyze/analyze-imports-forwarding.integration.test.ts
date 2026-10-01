import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { parseSync } from "oxc-parser";

import { typescriptAdapter } from "../code/typescript-adapter.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

/**
 * Files that all change in the same three commits. Three barrels hand on what
 * they import without `export … from`; a consumer of each imports only the barrel.
 * `other.ts` is imported by nobody and imports nothing.
 */
const sources = (version: number): Record<string, string> => ({
  "src/ui/Button.ts": `export const Button = 1;\n// ${version}\n`,
  "src/ui/index.ts": `import Button from "./Button";\nexport default Button;\n// ${version}\n`,
  "src/consumer1.ts": `import ui from "./ui/index";\nexport const consumer1 = ui;\n// ${version}\n`,
  "src/math.ts": `export const add = 1;\n// ${version}\n`,
  "src/mathIndex.ts": `import * as math from "./math";\nexport { math };\n// ${version}\n`,
  "src/consumer2.ts": `import { math } from "./mathIndex";\nexport const consumer2 = math;\n// ${version}\n`,
  "src/lib/a.js": `exports.a = 1;\n// ${version}\n`,
  "src/lib/index.js": `module.exports = { a: require("./a") };\n// ${version}\n`,
  "src/consumer3.js": `const lib = require("./lib");\nconsole.log(lib);\n// ${version}\n`,
  "src/other.ts": `export const other = 1;\n// ${version}\n`,
});

const analyzeFixture = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2024-01-01T12:00:00Z", sources(0));
  for (const version of [1, 2, 3]) {
    yield* repo.commit(day(version), sources(version));
  }
  return yield* analyze({
    ...analyzeOptionsFor(repo),
    adapters: [typescriptAdapter(parseSync)],
  });
});

const relationOf = (
  report: Effect.Success<typeof analyzeFixture>,
  a: string,
  b: string,
) =>
  report.couplings.find((coupling) => coupling.a === a && coupling.b === b)
    ?.imports;

layer(NodeServices.layer)(
  "analyze imports through barrels without export-from",
  (it) => {
    it.effect(
      "follows an imported binding that a barrel exports as its default",
      () =>
        Effect.gen(function* () {
          const report = yield* analyzeFixture;

          // consumer1.ts imports ui/index.ts, which imports Button.ts and exports it
          assert.strictEqual(
            relationOf(report, "src/consumer1.ts", "src/ui/Button.ts"),
            "a→b",
          );
        }),
    );

    it.effect("follows an imported namespace that a barrel exports", () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture;

        assert.strictEqual(
          relationOf(report, "src/consumer2.ts", "src/math.ts"),
          "a→b",
        );
      }),
    );

    it.effect(
      "follows what a CommonJS barrel requires and assigns to module.exports",
      () =>
        Effect.gen(function* () {
          const report = yield* analyzeFixture;

          assert.strictEqual(
            relationOf(report, "src/consumer3.js", "src/lib/a.js"),
            "a→b",
          );
        }),
    );

    it.effect("still calls a file nothing leads to hidden", () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture;

        assert.strictEqual(
          relationOf(report, "src/consumer1.ts", "src/other.ts"),
          "none",
        );
        assert.strictEqual(
          relationOf(report, "src/math.ts", "src/other.ts"),
          "none",
        );
      }),
    );
  },
);
