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
 * Commits `manifests` with `files(0)`, then `files(1..3)` in the window, so
 * every pair of files shares 3 commits; returns the `imports` of the pair
 * `a`, `b` as the report states it.
 */
const importsOfPair = (
  manifests: Readonly<Record<string, string>>,
  files: (version: number) => Record<string, string>,
  [a, b]: readonly [string, string],
) =>
  Effect.gen(function* () {
    yield* setNow;
    const repo = yield* makeTempRepository;
    yield* repo.commit(day(1), { ...manifests, ...files(0) });
    for (const version of [1, 2, 3]) {
      yield* repo.commit(day(version + 1), files(version));
    }
    const report = yield* analyze({
      ...analyzeOptionsFor(repo),
      adapters: [typescriptAdapter(parseSync)],
    });
    return report.couplings
      .filter((coupling) => coupling.a === a && coupling.b === b)
      .map(({ imports }) => imports);
  });

const entry = "backend/a/src/index.ts";
const user = "backend/b/src/use.ts";

layer(NodeServices.layer)(
  "analyze imports of a package without files",
  (it) => {
    it.effect(
      "resolves the name of a package without files of its own to the entry its manifest names in a sub-package",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsOfPair(
            {
              "backend/package.json":
                '{ "name": "backend", "main": "a/src/index.ts" }\n',
              "backend/a/package.json": '{ "name": "backend-a" }\n',
              "backend/b/package.json": '{ "name": "backend-b" }\n',
            },
            (version) => ({
              [entry]: `export const value = ${version};\n`,
              [user]: `import { value } from "backend";\nexport const used = value;\n// ${version}\n`,
            }),
            [entry, user],
          );

          assert.deepStrictEqual(imports, ["b→a"]);
        }),
    );

    it.effect(
      "leaves a name that a package with files claims to that package, not to a file-less one of the same name",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsOfPair(
            {
              "shared/package.json": '{ "name": "shared" }\n',
              "tools/package.json":
                '{ "name": "shared", "main": "gen/run.ts" }\n',
              "tools/gen/package.json": '{ "name": "gen" }\n',
              "web/package.json": '{ "name": "web" }\n',
            },
            (version) => ({
              "shared/index.ts": `export const value = ${version};\n`,
              "web/use.ts": `import { value } from "shared";\nexport const used = value;\n// ${version}\n`,
              "tools/gen/run.ts": `export const run = ${version};\n`,
            }),
            ["shared/index.ts", "web/use.ts"],
          );

          assert.deepStrictEqual(imports, ["b→a"]);
        }),
    );
  },
);
