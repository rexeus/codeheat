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

const CONTRACT = "packages/a/api/main.tsp";
const CODE = "packages/b/src/use.ts";

/**
 * Two packages: `a` owns code and a contract, `b` owns code. The first commit
 * adds everything; four more change the contract and `b`'s code together; the
 * last changes the contract alone.
 */
const contractChangingWithCode = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(day(1), {
      "packages/a/package.json": '{ "name": "a", "main": "src/index.ts" }\n',
      "packages/a/src/index.ts": "export * from './impl'\n",
      "packages/a/src/impl.ts": "export const a = 1\n",
      [CONTRACT]: "model A {}\n",
      "packages/b/package.json": '{ "name": "b" }\n',
      [CODE]: "export const b = 1\n",
    });
    for (const [index, date] of [2, 3, 4, 5].entries()) {
      yield* repo.commit(day(date), {
        [CONTRACT]: `model A { n: ${index} }\n`,
        [CODE]: `export const b = ${index + 2}\n`,
      });
    }
    yield* repo.commit(day(6), { [CONTRACT]: "model A { n: 9 }\n" });
  });

layer(NodeServices.layer)("analyze contract files", (it) => {
  it.effect(
    "couples a contract with the code that changes with it, without scoring it",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* contractChangingWithCode(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.files.map((file) => file.path).toSorted(),
          ["packages/a/src/impl.ts", "packages/a/src/index.ts", CODE],
        );
        assert.deepStrictEqual(report.couplings, [
          {
            a: CONTRACT,
            b: CODE,
            sharedCommits: 5,
            degree: 0.9091,
            distance: 4,
            testPair: false,
            kinds: { a: "contract", b: "code" },
            crossesModule: true,
            imports: null,
          },
        ]);
        assert.deepStrictEqual(report.contracts, [
          {
            path: CONTRACT,
            module: "packages/a",
            revisions: 6,
            linesAdded: 6,
            linesDeleted: 5,
          },
        ]);
        assert.deepStrictEqual(report.totals, {
          files: 3,
          contracts: 1,
          couplings: 1,
          modules: 2,
        });
      }),
  );
});

layer(NodeServices.layer)("analyze contract modules and reasons", (it) => {
  it.effect(
    "names the contract in the reasons of the code that follows it",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* contractChangingWithCode(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        const code = report.files.find((file) => file.path === CODE);
        assert.isTrue(
          code?.reasons.includes(
            `co-changes with the contract ${CONTRACT} in 100% of its commits`,
          ),
        );
      }),
  );

  it.effect(
    "counts a contract as a touch of its module, never as a file or as implementation",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* contractChangingWithCode(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        const moduleA = report.modules.find((m) => m.path === "packages/a");
        const moduleB = report.modules.find((m) => m.path === "packages/b");
        // a: the first commit and 5 contract changes; the 4 shared ones pull in b
        assert.deepStrictEqual(
          [moduleA?.files, moduleA?.commits, moduleA?.localCommits],
          [2, 6, 1],
        );
        assert.deepStrictEqual(moduleA?.partners, [
          { path: "packages/b", sharedCommits: 5 },
        ]);
        // only the first commit changed a's implementation; the contract commits did not
        assert.deepStrictEqual(
          [moduleA?.interfaceCommits, moduleA?.implementationCommits],
          [1, 1],
        );
        assert.deepStrictEqual(
          [moduleB?.files, moduleB?.commits, moduleB?.localCommits],
          [1, 5, 0],
        );
      }),
  );
});

layer(NodeServices.layer)(
  "analyze contract housing and generated output",
  (it) => {
    it.effect(
      "houses a contract outside every module in a directory of its own without making a module of it",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit(day(1), {
            "src/a/x.ts": "1\n",
            "src/b/y.ts": "1\n",
            "specs/openapi.yaml": "openapi: 3.0.0\n",
          });

          const report = yield* analyze(analyzeOptionsFor(repo));

          assert.deepStrictEqual(
            report.contracts.map(({ path, module }) => [path, module]),
            [["specs/openapi.yaml", "specs"]],
          );
          assert.deepStrictEqual(report.modules.map((m) => m.path).toSorted(), [
            "src/a",
            "src/b",
          ]);
        }),
    );

    it.effect(
      "keeps the output generated from a contract out of the report",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          for (const date of [1, 2, 3, 4]) {
            yield* repo.commit(day(date), {
              "api/main.tsp": `model A { n: ${date} }\n`,
              "tsp-output/openapi.yaml": `n: ${date}\n`,
              "src/generated/client.ts": `export const n = ${date}\n`,
              "src/client.ts": `export const n = ${date}\n`,
            });
          }

          const report = yield* analyze(analyzeOptionsFor(repo));

          assert.deepStrictEqual(
            report.contracts.map((contract) => contract.path),
            ["api/main.tsp"],
          );
          assert.deepStrictEqual(
            report.files.map((file) => file.path),
            ["src/client.ts"],
          );
        }),
    );
  },
);
