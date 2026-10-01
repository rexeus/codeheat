import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { parseSync } from "oxc-parser";

import { typescriptAdapter } from "../code/typescript-adapter.js";
import type { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";
import type { AnalyzeOptions } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const manifest = (json: Record<string, unknown>): string =>
  `${JSON.stringify(json)}\n`;

/** Every file as `version` writes it: the same imports, a different last line. */
const sources = (version: number): Record<string, string> => ({
  "src/alpha.ts": `import { beta } from "./beta.js";\nexport const alpha = beta;\n// ${version}\n`,
  "src/beta.ts": `export const beta = 1;\n// ${version}\n`,
  "src/gamma.ts": `export const gamma = 3;\n// ${version}\n`,
  "src/zeta.ts": `import type { alpha } from "./alpha";\nexport type Zeta = typeof alpha;\n// ${version}\n`,
  "src/left.ts": `export { right } from "./right";\nexport const left = 1;\n// ${version}\n`,
  "src/right.ts": `const { left } = require("./left");\nexports.right = left;\n// ${version}\n`,
  "src/script.py": `import os\n# ${version}\n`,
  "src/broken.ts": `export const = ${version};\n`,
  "packages/core/src/index.ts": `export * from "./money.js";\n// ${version}\n`,
  "packages/core/src/money.ts": `export const money = 1;\n// ${version}\n`,
  "packages/core/src/ledger.ts": `export const ledger = 1;\n// ${version}\n`,
  "packages/core/src/extra.ts": `export const extra = 1;\n// ${version}\n`,
  "packages/app/src/main.ts": `import { money } from "@acme/core";\nexport const main = money;\n// ${version}\n`,
});

/** The first commit is old; then three commits in the window rewrite every file, so every pair shares 3 commits. */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2024-01-01T12:00:00Z", {
      ...sources(0),
      "packages/core/package.json": manifest({
        name: "@acme/core",
        main: "src/ledger.ts",
        exports: { ".": "./src/index.ts", "./extra": "./src/extra.ts" },
      }),
      "packages/app/package.json": manifest({ name: "@acme/app" }),
    });
    for (const version of [1, 2, 3]) {
      yield* repo.commit(day(version), sources(version));
    }
  });

/** Analyzes the fixture history, reading imports unless `adapters` say otherwise. */
const analyzeFixture = (
  adapters = [typescriptAdapter(parseSync)],
  overrides: Partial<AnalyzeOptions> = {},
) =>
  Effect.gen(function* () {
    yield* setNow;
    const repo = yield* makeTempRepository;
    yield* buildHistory(repo);
    return yield* analyze({
      ...analyzeOptionsFor(repo),
      adapters,
      ...overrides,
    });
  });

/** The `imports` of each pair, in the order given. */
const relationsOf = (
  report: Report,
  pairs: ReadonlyArray<readonly [string, string]>,
) =>
  pairs.map(
    ([a, b]) =>
      report.couplings.find((coupling) => coupling.a === a && coupling.b === b)
        ?.imports,
  );

const HIDDEN_REASON =
  "changes with packages/app/src/main.ts in 100% of its commits without an import between them";

layer(NodeServices.layer)("analyze hidden coupling", (it) => {
  it.effect(
    "tells an imported pair from one coupled only through history",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture();

        // 13 files that all change in the same 3 commits: 78 pairs of degree 1
        assert.strictEqual(report.couplings.length, 78);
        assert.deepStrictEqual(
          relationsOf(report, [
            ["src/alpha.ts", "src/beta.ts"],
            ["src/alpha.ts", "src/zeta.ts"],
            ["src/left.ts", "src/right.ts"],
            ["src/alpha.ts", "src/gamma.ts"],
            ["src/beta.ts", "src/gamma.ts"],
          ]),
          ["a→b", "b→a", "both", "none", "none"],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze imports of workspace packages", (it) => {
  it.effect(
    "follows a workspace package name through its re-exporting entry point",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture();

        const main = "packages/app/src/main.ts";
        assert.deepStrictEqual(
          relationsOf(report, [
            [main, "packages/core/src/index.ts"],
            [main, "packages/core/src/money.ts"],
            [main, "packages/core/src/ledger.ts"],
          ]),
          ["a→b", "a→b", "none"],
        );
      }),
  );

  it.effect(
    "resolves a package name to what its exports map says for the root, not to every target",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture();

        const main = "packages/app/src/main.ts";
        // main.ts imports "@acme/core": exports["."] is index.ts; main (ledger.ts) and exports["./extra"] are not it
        assert.deepStrictEqual(
          relationsOf(report, [
            [main, "packages/core/src/extra.ts"],
            [main, "packages/core/src/ledger.ts"],
          ]),
          ["none", "none"],
        );
      }),
  );

  it.effect(
    "resolves package names the same way with --entry, which only names interfaces",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture(undefined, {
          entry: ["packages/core/src/extra.ts"],
        });

        const main = "packages/app/src/main.ts";
        assert.deepStrictEqual(
          relationsOf(report, [
            [main, "packages/core/src/index.ts"],
            [main, "packages/core/src/money.ts"],
            [main, "packages/core/src/extra.ts"],
          ]),
          ["a→b", "a→b", "none"],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze unknown import relations", (it) => {
  it.effect(
    "leaves the relation unknown for a non-TypeScript or unparseable file",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture();

        assert.deepStrictEqual(
          relationsOf(report, [
            ["src/alpha.ts", "src/script.py"],
            ["src/alpha.ts", "src/broken.ts"],
            ["src/broken.ts", "src/script.py"],
          ]),
          [null, null, null],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze hidden coupling reasons", (it) => {
  it.effect(
    "explains a file by the partner it changes with unrelated to it",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture();

        // the partners of gamma.ts tie at 100%; the first by path is main.ts, which does not import it
        const gamma = report.files.find(({ path }) => path === "src/gamma.ts");
        assert.isTrue(gamma?.reasons.includes(HIDDEN_REASON));
      }),
  );

  it.effect("reports no relation and no hidden coupling without adapters", () =>
    Effect.gen(function* () {
      const report = yield* analyzeFixture([]);

      assert.strictEqual(report.couplings.length, 78);
      assert.isTrue(report.couplings.every(({ imports }) => imports === null));
      const gamma = report.files.find(({ path }) => path === "src/gamma.ts");
      assert.isFalse(gamma?.reasons.includes(HIDDEN_REASON));
    }),
  );
});
