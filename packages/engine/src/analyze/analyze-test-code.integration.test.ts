import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { reportOf } from "../projection/report-of.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const CODE = ["src/a.ts", "src/b.ts"];
const TESTS = [
  "src/a.test.ts",
  "src/b.spec.ts",
  "src/__tests__/c.ts",
  "test/helpers/setup.ts",
  "e2e/flow.ts",
];

const BULK = Array.from({ length: 60 }, (_, index) => `test/bulk/${index}.ts`);

const version = (files: ReadonlyArray<string>, value: number) =>
  Object.fromEntries(
    files.map((file) => [
      file,
      `export const value = ${value};\nif (value) {\n  run(value);\n}\n`,
    ]),
  );

layer(NodeServices.layer)("analyze test code", (it) => {
  it.effect(
    "measures a change of two code files and its tests as a change of the two code files, however many tests",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        for (const value of [1, 2, 3, 4]) {
          yield* repo.commit(day(value), version([...CODE, ...TESTS], value));
        }
        yield* repo.commit(day(5), version(TESTS, 5));
        yield* repo.commit(day(6), version([...CODE, ...BULK], 6));

        const analysis = yield* analyze(analyzeOptionsFor(repo));
        const report = reportOf(analysis);

        assert.deepStrictEqual(
          analysis.couplings.map(({ a, b, sharedCommits }) => ({
            a,
            b,
            sharedCommits,
          })),
          [{ a: "src/a.ts", b: "src/b.ts", sharedCommits: 5 }],
        );
        assert.strictEqual(analysis.window.couplingCommits, 5);
        assert.deepStrictEqual(
          analysis.files.map(({ path }) => path),
          CODE,
        );
        assert.deepStrictEqual(
          analysis.territories.nodes.map(({ path, kind, files }) => ({
            path,
            kind,
            files,
          })),
          [{ path: ".", kind: "folder", files: 2 }],
        );
        assert.deepStrictEqual(
          report.hotspots.map(({ path }) => path),
          CODE,
        );
        assert.deepStrictEqual(
          analysis.testCode,
          [
            ...TESTS.map((path) => ({ path, changes: 5 })),
            ...BULK.map((path) => ({ path, changes: 1 })),
          ].toSorted((a, b) => a.path.localeCompare(b.path)),
        );
      }),
  );
});

layer(NodeServices.layer)("analyze a window of test code", (it) => {
  it.effect(
    "finds a window quiet whose commits touched nothing but test code",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(
          "2024-01-01T12:00:00Z",
          version([...CODE, ...TESTS], 1),
        );
        yield* repo.commit(day(1), version(TESTS, 2));
        yield* repo.commit(day(2), version(TESTS, 3));

        const analysis = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          [
            analysis.window.commits,
            analysis.window.realCommits,
            analysis.logicalChanges.count,
            analysis.verdict.reason,
          ],
          [2, 0, 0, "quiet-window"],
        );
      }),
  );
});

/** A minute of one afternoon in the window. */
const at = (minute: number) =>
  `2026-05-10T12:${String(minute).padStart(2, "0")}:00Z`;

/** A pull request of 20 commits of code and `tests` commits of its tests alone, squash-merged one by one with its number. */
const pullRequest = (tests: number) =>
  Effect.gen(function* () {
    const repo = yield* makeTempRepository;
    for (let index = 0; index < 20; index += 1) {
      yield* repo.commit(
        at(index),
        version(["src/a.ts"], index),
        "feat: a (#12)",
      );
    }
    for (let index = 0; index < tests; index += 1) {
      yield* repo.commit(
        at(20 + index),
        version(["src/a.test.ts"], index),
        "test: a (#12)",
      );
    }
    return yield* analyze(analyzeOptionsFor(repo));
  });

layer(NodeServices.layer)(
  "analyze a pull request with commits of tests alone",
  (it) => {
    it.effect(
      "keeps the pull request one change, however many of its commits touched only tests",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          for (const tests of [9, 11]) {
            const analysis = yield* pullRequest(tests);

            assert.deepStrictEqual(
              [
                analysis.logicalChanges.count,
                analysis.logicalChanges.largest,
                analysis.window.realCommits,
                analysis.files.find(({ path }) => path === "src/a.ts")?.changes,
              ],
              [1, 20, 20, 1],
            );
          }
        }),
    );
  },
);
