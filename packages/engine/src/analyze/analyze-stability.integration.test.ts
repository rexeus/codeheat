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

const manifest = JSON.stringify({ name: "package" });
const APP_FILES = ["a", "b", "c", "d", "e"];

const importer = (name: string, revision: number): string =>
  `import { api } from "../../core/src/api";\nexport const ${name} = api + ${revision};\n`;

/**
 * `core/src/api.ts` is imported by five files of `app` and one of `stable`.
 * Everything changes in the first commit; then `api.ts`, `a.ts`, and `b.ts`
 * change together in five more, so `core` changes in six commits, `app` in six
 * and `stable` in one.
 */
const analyzeSharedApi = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit(day(1), {
    "packages/core/package.json": manifest,
    "packages/app/package.json": manifest,
    "packages/stable/package.json": manifest,
    "packages/core/src/api.ts": "export const api = 0;\n",
    "packages/stable/src/s.ts": importer("s", 0),
    ...Object.fromEntries(
      APP_FILES.map((name) => [
        `packages/app/src/${name}.ts`,
        importer(name, 0),
      ]),
    ),
  });
  for (let revision = 1; revision <= 5; revision += 1) {
    yield* repo.commit(day(revision + 1), {
      "packages/core/src/api.ts": `export const api = ${revision};\n`,
      "packages/app/src/a.ts": importer("a", revision),
      "packages/app/src/b.ts": importer("b", revision),
    });
  }
  return yield* analyze(
    analyzeOptionsFor(repo, { adapters: [typescriptAdapter(parseSync)] }),
  );
});

layer(NodeServices.layer)("analyze stability", (it) => {
  it.effect(
    "reports a file many files import that changes more often than they do",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeSharedApi;

        assert.deepStrictEqual(report.unstableInterfaces, [
          {
            path: "packages/core/src/api.ts",
            module: "packages/core",
            fanIn: 6,
            revisions: 6,
            medianDependentRevisions: 1,
            changedDependents: 6,
            dependents: [
              { path: "packages/app/src/a.ts", sharedCommits: 6 },
              { path: "packages/app/src/b.ts", sharedCommits: 6 },
              { path: "packages/app/src/c.ts", sharedCommits: 1 },
              { path: "packages/app/src/d.ts", sharedCommits: 1 },
              { path: "packages/app/src/e.ts", sharedCommits: 1 },
            ],
            reason:
              "6 files depend on it and it changed in 6 commits, against a median of 1 for them; 6 of them changed together with it",
          },
        ]);
        assert.strictEqual(report.thresholds.minFanIn, 5);
        assert.strictEqual(report.thresholds.minInterfaceRevisions, 5);
      }),
  );

  it.effect(
    "flags the module that rarely changes for importing the one that changes often",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeSharedApi;

        assert.deepStrictEqual(report.dependencyDirection, [
          {
            from: "packages/stable",
            to: "packages/core",
            importingFiles: 1,
            fromCommits: 1,
            toCommits: 6,
            reason:
              "1 file of packages/stable, which changed in 1 commit, import packages/core, which changed in 6",
          },
        ]);
        assert.strictEqual(report.thresholds.minVolatilityRatio, 2);
      }),
  );
});
