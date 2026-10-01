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

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const release = "scripts/release.ts";
const entry = "packages/app/src/index.ts";
const tax = "packages/app/src/billing/tax.ts";

/** The files that change in each of the three commits of the window. */
const changing = (version: number): Record<string, string> => ({
  [entry]: `export { invoice } from "./billing/invoice.js";\n// ${version}\n`,
  [tax]: `export const tax = 1;\n// ${version}\n`,
  [release]: `import { invoice } from "app";\nexport const run = invoice;\n// ${version}\n`,
});

/**
 * The only package, `app`, with 22 files, and a script that imports it by name.
 * The package holds more than 70 % of at least 20 files, so it is split into
 * directory modules, and stays importable by its name.
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2024-01-01T12:00:00Z", {
      ...changing(0),
      "packages/app/package.json":
        '{ "name": "app", "main": "src/index.ts" }\n',
      "packages/app/src/billing/invoice.ts": "export const invoice = 1;\n",
      ...Object.fromEntries(
        ["billing", "auth"].flatMap((directory) =>
          Array.from({ length: 10 }, (_, index) => [
            `packages/app/src/${directory}/still${index}.ts`,
            "export const still = 1;\n",
          ]),
        ),
      ),
    });
    for (const version of [1, 2, 3]) {
      yield* repo.commit(day(version), changing(version));
    }
  });

const importsOf = (report: Report, a: string, b: string) =>
  report.couplings.find((coupling) => coupling.a === a && coupling.b === b)
    ?.imports;

layer(NodeServices.layer)("analyze imports of a split package", (it) => {
  it.effect("still resolves the package by its name", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* buildHistory(repo);

      const report = yield* analyze({
        ...analyzeOptionsFor(repo),
        adapters: [typescriptAdapter(parseSync)],
      });

      assert.deepStrictEqual(
        report.modules.map(({ kind }) => kind),
        ["directory", "directory", "directory", "directory"],
      );
      // release.ts imports "app", which is index.ts; tax.ts is not reached from it
      assert.deepStrictEqual(
        [importsOf(report, entry, release), importsOf(report, tax, release)],
        ["b→a", "none"],
      );
    }),
  );
});
