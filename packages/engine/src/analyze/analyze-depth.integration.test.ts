import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { parseSync } from "oxc-parser";

import type { LanguageAdapter } from "../code/language-adapter.js";
import { typescriptAdapter } from "../code/typescript-adapter.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const manifest = (main: string): string => `${JSON.stringify({ main })}\n`;

/** `count` code lines that export nothing. */
const filler = (count: number): string =>
  Array.from({ length: count }, (_, index) => `const v${index} = ${index};`)
    .join("\n")
    .concat("\n");

/** An entry point of 120 lines exporting ten functions. */
const tenFunctions = Array.from(
  { length: 10 },
  (_, index) =>
    `export function f${index}() {\n${filler(9)}return ${index};\n}\n`,
).join("");

/**
 * One package per case. Lines are non-blank lines.
 *
 * - deep: 2 exports (`open`, `Options`) over engine.ts (40) and options.ts (1); engine.test.ts does not count
 * - shallow: 6 exports (a to d by name, e and f by `export *`) over impl.ts (4) and more.ts (2)
 * - cyclic: `own`, `fromA`, `fromB`, but not b's default, over a.ts (2) and b.ts (3)
 * - named-external: 1 export, forwarded by name from a package, over impl.ts (3)
 * - bare and configured: the same index.ts exporting ten functions, the second next to a two-line eslint.config.mjs; a configuration file is no implementation, so both have no depth
 * - configured-impl: 2 exports over impl.ts (5); its configuration files (2 and 3) do not count
 */
const files: Readonly<Record<string, string>> = {
  "packages/deep/package.json": manifest("src/index.ts"),
  "packages/deep/src/index.ts":
    'export { open } from "./engine.js";\nexport type { Options } from "./options.js";\n',
  "packages/deep/src/engine.ts": `export const open = () => 1;\n${filler(39)}`,
  "packages/deep/src/options.ts": "export type Options = { a: number };\n",
  "packages/deep/src/engine.test.ts": filler(100),

  "packages/shallow/package.json": manifest("src/index.ts"),
  "packages/shallow/src/index.ts":
    'export { a, b, c, d } from "./impl.js";\nexport * from "./more.js";\n',
  "packages/shallow/src/impl.ts":
    "export const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\n",
  "packages/shallow/src/more.ts": "export const e = 5;\nexport const f = 6;\n",

  "packages/cyclic/package.json": manifest("src/index.ts"),
  "packages/cyclic/src/index.ts":
    'export * from "./a.js";\nexport const own = 1;\n',
  "packages/cyclic/src/a.ts":
    'export * from "./b.js";\nexport const fromA = 1;\n',
  "packages/cyclic/src/b.ts":
    'export * from "./a.js";\nexport const fromB = 1;\nexport default 1;\n',

  "packages/named-external/package.json": manifest("src/index.ts"),
  "packages/named-external/src/index.ts": 'export { pad } from "left-pad";\n',
  "packages/named-external/src/impl.ts": filler(3),

  "packages/star-external/package.json": manifest("src/index.ts"),
  "packages/star-external/src/index.ts": 'export * from "left-pad";\n',
  "packages/star-external/src/impl.ts": filler(3),

  "packages/unresolved/package.json": manifest("src/index.ts"),
  "packages/unresolved/src/index.ts": 'export * from "./missing.js";\n',
  "packages/unresolved/src/impl.ts": filler(3),

  "packages/foreign/package.json": manifest("src/index.ts"),
  "packages/foreign/src/index.ts":
    'export * from "../../deep/src/engine.js";\n',
  "packages/foreign/src/impl.ts": filler(3),

  "packages/broken/package.json": manifest("src/index.ts"),
  "packages/broken/src/index.ts": "export const = 1;\n",
  "packages/broken/src/impl.ts": filler(3),

  "packages/commonjs/package.json": manifest("index.js"),
  "packages/commonjs/index.js": "module.exports = { a: 1 };\n",
  "packages/commonjs/impl.js": filler(3),

  "packages/python/package.json": manifest("__init__.py"),
  "packages/python/__init__.py": "from .impl import a\n",
  "packages/python/impl.py": "a = 1\nb = 2\n",

  "packages/bare/package.json": manifest("src/index.ts"),
  "packages/bare/src/index.ts": tenFunctions,
  "packages/configured/package.json": manifest("src/index.ts"),
  "packages/configured/src/index.ts": tenFunctions,
  "packages/configured/eslint.config.mjs":
    "export default [];\nconst unused = 1;\n",

  "packages/configured-impl/package.json": manifest("src/index.ts"),
  "packages/configured-impl/src/index.ts":
    'export { a, b } from "./impl.js";\n',
  "packages/configured-impl/src/impl.ts": `export const a = 1;\nexport const b = 2;\n${filler(3)}`,
  "packages/configured-impl/eslint.config.mjs":
    "export default [];\nconst unused = 1;\n",
  "packages/configured-impl/vitest.config.ts": filler(3),

  "packages/lonely/package.json": manifest("src/index.ts"),
  "packages/lonely/src/index.ts": "export const a = 1;\n",

  "packages/silent/package.json": manifest("src/index.ts"),
  "packages/silent/src/index.ts": 'console.log("side effect");\n',
  "packages/silent/src/impl.ts": filler(3),

  "packages/no-entry/package.json": "{}\n",
  "packages/no-entry/util.ts": filler(3),
};

const analyzeShop = (adapters: ReadonlyArray<LanguageAdapter>) =>
  Effect.gen(function* () {
    yield* setNow;
    const repo = yield* makeTempRepository;
    yield* repo.commit("2026-05-01T12:00:00Z", files);
    const report = yield* analyze({
      ...analyzeOptionsFor(repo),
      adapters,
    });
    return new Map(report.modules.map((module) => [module.path, module.depth]));
  });

layer(NodeServices.layer)("analyze module depth", (it) => {
  it.effect("tells a deep module from a shallow one", () =>
    Effect.gen(function* () {
      const depths = yield* analyzeShop([typescriptAdapter(parseSync)]);

      assert.deepStrictEqual(depths.get("packages/deep"), {
        exports: 2,
        implementationLines: 41,
        linesPerExport: 20.5,
      });
      assert.deepStrictEqual(depths.get("packages/shallow"), {
        exports: 6,
        implementationLines: 6,
        linesPerExport: 1,
      });
    }),
  );

  it.effect(
    "follows re-exports through a cycle and counts a name forwarded from a package",
    () =>
      Effect.gen(function* () {
        const depths = yield* analyzeShop([typescriptAdapter(parseSync)]);

        assert.deepStrictEqual(depths.get("packages/cyclic"), {
          exports: 3,
          implementationLines: 5,
          linesPerExport: 1.6667,
        });
        assert.deepStrictEqual(depths.get("packages/named-external"), {
          exports: 1,
          implementationLines: 3,
          linesPerExport: 3,
        });
        assert.deepStrictEqual(depths.get("packages/configured-impl"), {
          exports: 2,
          implementationLines: 5,
          linesPerExport: 2.5,
        });
      }),
  );
});

layer(NodeServices.layer)("analyze module depth that cannot be told", (it) => {
  it.effect("reports no depth where the exports cannot be told exactly", () =>
    Effect.gen(function* () {
      const depths = yield* analyzeShop([typescriptAdapter(parseSync)]);

      const unknown = [
        "packages/star-external",
        "packages/unresolved",
        "packages/foreign",
        "packages/broken",
        "packages/commonjs",
        "packages/python",
        "packages/bare",
        "packages/configured",
        "packages/lonely",
        "packages/silent",
        "packages/no-entry",
      ];
      assert.deepStrictEqual(
        unknown.map((path) => [path, depths.get(path)]),
        unknown.map((path) => [path, null]),
      );
    }),
  );

  it.effect("reports no depth without a parser", () =>
    Effect.gen(function* () {
      const depths = yield* analyzeShop([]);

      assert.isTrue(depths.has("packages/deep"));
      assert.isTrue([...depths.values()].every((depth) => depth === null));
    }),
  );
});
