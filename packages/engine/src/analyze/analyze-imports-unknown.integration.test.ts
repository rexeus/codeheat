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
 * Files that all change in the same three commits, so every pair is coupled,
 * each written with its own imports. `one.ts` and `two.ts` import nothing.
 */
const sources = (version: number): Record<string, string> => ({
  "src/one.ts": `export type One = number;\n// ${version}\n`,
  "src/two.ts": `export const two = 2;\n// ${version}\n`,
  "src/dep.ts": `import { useState } from "react";\nimport { readFileSync } from "node:fs";\nexport const dep = [useState, readFileSync];\n// ${version}\n`,
  "src/styled.ts": `import "./style.css";\nexport const styled = 1;\n// ${version}\n`,
  "src/types.ts": `export type Types = import("./one").One;\n// ${version}\n`,
  "src/alias.ts": `import { util } from "@/util";\nexport const alias = util;\n// ${version}\n`,
  "src/hash.ts": `import { db } from "#internal/db";\nexport const hash = db;\n// ${version}\n`,
  "src/undeclared.ts": `import { pad } from "left-pad";\nexport const undeclared = pad;\n// ${version}\n`,
  "src/lazy.ts": `export const load = (name: string) => import(\`./pages/\${name}\`);\n// ${version}\n`,
  "src/user.ts": `import { one } from "./broken-barrel";\nexport const user = one;\n// ${version}\n`,
  "src/broken-barrel.ts": `export * from "./one";\nexport const = ${version};\n`,
  "src/duplicate.ts": `import { x } from "@acme/dup";\nexport const duplicate = x;\n// ${version}\n`,
  "src/viaDist.ts": `import { built } from "../dist/barrel";\nexport const viaDist = built;\n// ${version}\n`,
});

const analyzeFixture = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2024-01-01T12:00:00Z", {
    ...sources(0),
    "package.json": '{ "devDependencies": { "react": "19.0.0" } }\n',
    "src/style.css": "a { color: red; }\n",
    "dist/barrel.ts": "export const built = 1;\n",
    "packages/a/package.json": '{ "name": "@acme/dup" }\n',
    "packages/a/index.ts": "export const x = 1;\n",
    "packages/b/package.json": '{ "name": "@acme/dup" }\n',
    "packages/b/index.ts": "export const x = 2;\n",
  });
  for (const version of [1, 2, 3]) {
    yield* repo.commit(day(version), sources(version));
  }
  return yield* analyze({
    ...analyzeOptionsFor(repo),
    adapters: [typescriptAdapter(parseSync)],
  });
});

/** The `imports` of the pair of `src/<a>.ts` and `src/<b>.ts`, whichever order they sort in. */
const relationOf = (
  report: Effect.Success<typeof analyzeFixture>,
  a: string,
  b: string,
) => {
  const [first, second] = [`src/${a}.ts`, `src/${b}.ts`].toSorted();
  return report.couplings.find(
    (coupling) => coupling.a === first && coupling.b === second,
  )?.imports;
};

layer(NodeServices.layer)("analyze imports that can be told", (it) => {
  it.effect(
    "calls files hidden-coupled when everything they load is accounted for",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture;

        assert.strictEqual(report.couplings.length, 78);
        assert.strictEqual(relationOf(report, "one", "two"), "none");
        // react is declared by a manifest, node:fs is a built-in, style.css is a tracked asset
        assert.strictEqual(relationOf(report, "dep", "one"), "none");
        assert.strictEqual(relationOf(report, "styled", "one"), "none");
      }),
  );

  it.effect("sees the module of a TypeScript import type", () =>
    Effect.gen(function* () {
      const report = yield* analyzeFixture;

      assert.strictEqual(relationOf(report, "types", "one"), "b→a");
    }),
  );
});

layer(NodeServices.layer)("analyze imports that cannot be told", (it) => {
  it.effect(
    "leaves imports through aliases and undeclared packages unknown",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture;

        // "@/util" is a tsconfig path alias, "#internal/db" a subpath import, "left-pad" declared nowhere
        assert.isNull(relationOf(report, "alias", "one"));
        assert.isNull(relationOf(report, "hash", "one"));
        assert.isNull(relationOf(report, "undeclared", "one"));
      }),
  );

  it.effect(
    "leaves an import of a package name that two manifests claim unknown",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture;

        assert.isNull(relationOf(report, "duplicate", "one"));
      }),
  );

  it.effect("leaves a file that loads a module by an expression unknown", () =>
    Effect.gen(function* () {
      const report = yield* analyzeFixture;

      assert.isNull(relationOf(report, "lazy", "one"));
    }),
  );

  it.effect(
    "leaves a pair unknown when a barrel in the re-export closure is unparseable or excluded",
    () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture;

        // user.ts imports a barrel with a syntax error; viaDist.ts one in dist/, which is outside the universe
        assert.isNull(relationOf(report, "user", "two"));
        assert.isNull(relationOf(report, "viaDist", "two"));
      }),
  );
});
