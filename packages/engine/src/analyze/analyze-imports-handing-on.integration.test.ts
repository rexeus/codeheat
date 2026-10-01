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

/** Files that never change after the first commit, so they take part in no coupling. */
const still: Record<string, string> = {
  "src/registry.ts":
    "export default import.meta.glob('./pages/*.ts', { eager: true });\n",
  "src/ctx.js": "module.exports = require.context('./icons');\n",
  "src/routes.ts":
    "export default [{ path: '/', load: () => import('./Page') }];\n",
  "src/plain.ts": "export const plain = 1;\n",
  "src/barrel.ts":
    "export * from './target';\nexport default { version: 1 };\n",
  "src/api.ts":
    "import { run } from './target';\nexport const api = { run };\n",
  "src/usage.ts":
    "import { run } from './target';\nexport function f() { return run(); }\n",
  "src/Comp.vue": "<script>export default {};</script>\n",
  "src/constants/index.ts": "export const A = 1;\n",
};

/** Files that all change in the same three commits; each imports what its name says, and `target.ts` is what they may reach. */
const changing = (version: number): Record<string, string> =>
  Object.fromEntries(
    Object.entries({
      "src/target.ts": "export const run = () => 1;\n",
      "src/main1.ts":
        "import registry from './registry';\nexport const main1 = registry;\n",
      "src/main2.js": "const ctx = require('./ctx');\nconsole.log(ctx);\n",
      "src/main3.ts":
        "import routes from './routes';\nexport const main3 = routes;\n",
      "src/main4.ts":
        "import { plain } from './plain';\nexport const main4 = plain;\n",
      "src/main5.ts":
        "import barrel from './barrel';\nexport const main5 = barrel;\n",
      "src/main6.ts":
        "import { api } from './api';\nexport const main6 = api;\n",
      "src/main7.ts": "import { f } from './usage';\nexport const main7 = f;\n",
      "src/main8.ts":
        "import Comp from './Comp.vue';\nexport const main8 = Comp;\n",
      "src/main9.ts":
        "import { A } from 'constants';\nexport const main9 = A;\n",
      "src/main10.ts":
        "import { readFileSync } from 'fs';\nexport const main10 = readFileSync;\n",
    }).map(([file, content]) => [file, `${content}// ${version}\n`]),
  );

const analyzeFixture = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2024-01-01T12:00:00Z", { ...still, ...changing(0) });
  for (const version of [1, 2, 3]) {
    yield* repo.commit(day(version), changing(version));
  }
  return yield* analyze({
    ...analyzeOptionsFor(repo),
    adapters: [typescriptAdapter(parseSync)],
  });
});

/** The `imports` of `src/<main>` and `src/target.ts`; `main` sorts before `target`, so it is `a`. */
const relationOf = (
  report: Effect.Success<typeof analyzeFixture>,
  main: string,
) =>
  report.couplings.find(
    (coupling) =>
      coupling.a === `src/${main}` && coupling.b === "src/target.ts",
  )?.imports;

layer(NodeServices.layer)(
  "analyze imports through files that load modules by expression",
  (it) => {
    it.effect(
      "leaves a pair unknown when a file it imports globs, requires a context, or lazy-loads, though that file is coupled to nothing",
      () =>
        Effect.gen(function* () {
          const report = yield* analyzeFixture;

          assert.isNull(relationOf(report, "main1.ts"));
          assert.isNull(relationOf(report, "main2.js"));
          assert.isNull(relationOf(report, "main3.ts"));
        }),
    );

    it.effect(
      "still calls a pair hidden when the file it imports loads nothing",
      () =>
        Effect.gen(function* () {
          const report = yield* analyzeFixture;

          assert.strictEqual(relationOf(report, "main4.ts"), "none");
        }),
    );
  },
);

layer(NodeServices.layer)(
  "analyze imports through files that hand on what they import",
  (it) => {
    it.effect(
      "keeps export-from when the barrel also exports a default object",
      () =>
        Effect.gen(function* () {
          const report = yield* analyzeFixture;

          assert.strictEqual(relationOf(report, "main5.ts"), "a→b");
        }),
    );

    it.effect(
      "follows an import inside an exported initializer, not one an exported function only uses",
      () =>
        Effect.gen(function* () {
          const report = yield* analyzeFixture;

          assert.strictEqual(relationOf(report, "main6.ts"), "a→b");
          assert.strictEqual(relationOf(report, "main7.ts"), "none");
        }),
    );
  },
);

layer(NodeServices.layer)(
  "analyze imports of names that could mean something else",
  (it) => {
    it.effect(
      "leaves a component file and a built-in name that local code shares unknown",
      () =>
        Effect.gen(function* () {
          const report = yield* analyzeFixture;

          assert.isNull(relationOf(report, "main8.ts"));
          assert.isNull(relationOf(report, "main9.ts"));
        }),
    );

    it.effect("accounts for a built-in that nothing local is named after", () =>
      Effect.gen(function* () {
        const report = yield* analyzeFixture;

        assert.strictEqual(relationOf(report, "main10.ts"), "none");
      }),
    );
  },
);
