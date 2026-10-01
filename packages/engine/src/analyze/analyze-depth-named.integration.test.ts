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

const manifest = `${JSON.stringify({ main: "src/index.ts" })}\n`;

/**
 * A name that a named re-export takes is certain even when what it stands for
 * is out of sight; one package per case, each with a one-line `impl.ts`.
 *
 * - excluded: `Client` comes from a file that `--exclude` removed from the universe
 * - asset: `logo` comes from an image
 * - missing: `gone` comes from a file that does not exist
 * - forwarding: `a` comes from a file that only forwards a package with `export *`
 */
const files: Readonly<Record<string, string>> = {
  "packages/excluded/package.json": manifest,
  "packages/excluded/src/index.ts":
    'export { a } from "./impl.js";\nexport { Client } from "./client.generated.js";\n',
  "packages/excluded/src/impl.ts": "export const a = 1;\n",
  "packages/excluded/src/client.generated.ts": "export class Client {}\n",

  "packages/asset/package.json": manifest,
  "packages/asset/src/index.ts":
    'export { default as logo } from "./logo.svg";\nexport { a } from "./impl.js";\n',
  "packages/asset/src/impl.ts": "export const a = 1;\n",
  "packages/asset/src/logo.svg": "<svg />\n",

  "packages/missing/package.json": manifest,
  "packages/missing/src/index.ts":
    'export { gone } from "./missing.js";\nexport { a } from "./impl.js";\n',
  "packages/missing/src/impl.ts": "export const a = 1;\n",

  "packages/forwarding/package.json": manifest,
  "packages/forwarding/src/index.ts": 'export { a } from "./a.js";\n',
  "packages/forwarding/src/a.ts": 'export * from "left-pad";\n',
};

const depthsOf = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-05-01T12:00:00Z", files);
  const report = yield* analyze({
    ...analyzeOptionsFor(repo, { exclude: ["**/*.generated.ts"] }),
    adapters: [typescriptAdapter(parseSync)],
  });
  return new Map(report.modules.map((module) => [module.path, module.depth]));
});

layer(NodeServices.layer)("analyze module depth of unseen re-exports", (it) => {
  it.effect("counts a name taken from a file the universe leaves out", () =>
    Effect.gen(function* () {
      const depths = yield* depthsOf;

      assert.deepStrictEqual(depths.get("packages/excluded"), {
        exports: 2,
        implementationLines: 1,
        linesPerExport: 0.5,
      });
    }),
  );

  it.effect("counts a name taken from an asset or from a missing file", () =>
    Effect.gen(function* () {
      const depths = yield* depthsOf;

      const expected = {
        exports: 2,
        implementationLines: 1,
        linesPerExport: 0.5,
      };
      assert.deepStrictEqual(depths.get("packages/asset"), expected);
      assert.deepStrictEqual(depths.get("packages/missing"), expected);
    }),
  );

  it.effect("counts a name taken from a file that forwards a package", () =>
    Effect.gen(function* () {
      const depths = yield* depthsOf;

      assert.deepStrictEqual(depths.get("packages/forwarding"), {
        exports: 1,
        implementationLines: 1,
        linesPerExport: 1,
      });
    }),
  );
});
