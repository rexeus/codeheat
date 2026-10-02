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

layer(NodeServices.layer)(
  "analyze imports of a package without files",
  (it) => {
    it.effect(
      "resolves the name of a package without files of its own to the entry its manifest names in a sub-package",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          const entry = "backend/a/src/index.ts";
          const user = "backend/b/src/use.ts";
          const files = (version: number): Record<string, string> => ({
            [entry]: `export const value = ${version};\n`,
            [user]: `import { value } from "backend";\nexport const used = value;\n// ${version}\n`,
          });
          yield* repo.commit(day(1), {
            "backend/package.json":
              '{ "name": "backend", "main": "a/src/index.ts" }\n',
            "backend/a/package.json": '{ "name": "backend-a" }\n',
            "backend/b/package.json": '{ "name": "backend-b" }\n',
            ...files(0),
          });
          for (const version of [1, 2, 3]) {
            yield* repo.commit(day(version + 1), files(version));
          }

          const report = yield* analyze({
            ...analyzeOptionsFor(repo),
            adapters: [typescriptAdapter(parseSync)],
          });

          assert.deepStrictEqual(
            report.couplings.map(({ a, b, imports }) => [a, b, imports]),
            [[entry, user, "b→a"]],
          );
        }),
    );
  },
);
