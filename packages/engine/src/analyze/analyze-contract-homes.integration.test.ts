import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const SPEC = "spec/models.tsp";
const HANDLER = "packages/api/src/handler.ts";

/**
 * A design-first workspace: `spec/` holds a contract and no code, two
 * packages implement it, and a root config file makes `.` a module. The
 * handler follows the contract in twelve commits; one commit touches the root
 * file alone.
 */
const designFirstWorkspace = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(day(1), {
      "eslint.config.js": "export default []\n",
      "packages/api/package.json": '{ "name": "api" }\n',
      [HANDLER]: "export const n = 0\n",
      "packages/web/package.json": '{ "name": "web" }\n',
      "packages/web/src/page.ts": "export const p = 0\n",
      [SPEC]: "model A { n: 0 }\n",
    });
    for (let index = 1; index <= 12; index += 1) {
      yield* repo.commit(day(index + 1), {
        [SPEC]: `model A { n: ${index} }\n`,
        [HANDLER]: `export const n = ${index}\n`,
      });
    }
    yield* repo.commit(day(14), { "eslint.config.js": "export default [1]\n" });
  });

layer(NodeServices.layer)("analyze contract homes", (it) => {
  it.effect(
    "does not house every outside contract in the root module because a root file exists",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* designFirstWorkspace(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.contracts.map(({ path, module }) => [path, module]),
          [[SPEC, "spec"]],
        );
        const root = report.modules.find((module) => module.path === ".");
        // the first commit touched every module; the root file's own commit is local
        assert.deepStrictEqual([root?.commits, root?.localCommits], [2, 1]);
      }),
  );
});
