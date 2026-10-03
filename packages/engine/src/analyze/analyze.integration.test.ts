import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const NOW = "2026-06-01T12:00:00Z";
const setNow = TestClock.setTime(Date.parse(NOW));

/** Indentation complexity 9 (levels 0 1 2 3 2 1 0). */
const deep =
  "function f() {\n  if (a) {\n    if (b) {\n      run();\n    }\n  }\n}\n";
/** Indentation complexity 1. */
const shallow = "function g() {\n  h();\n}\n";
/** Indentation complexity 0. */
const flat = "a();\nb();\n";

/** `base` followed by `count - 1` unindented comment lines: same complexity, new content. */
const revision = (base: string, count: number): string =>
  base +
  Array.from({ length: count - 1 }, (_, index) => `// ${index + 2}\n`).join("");

/** `count` files whose content is `version`, so a commit of them changes every file. */
const filesAtVersion = (
  count: number,
  version: number,
): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `f${index}.ts`,
      `${version}\n`,
    ]),
  );

layer(NodeServices.layer)("analyze ranking", (it) => {
  it.effect("ranks files by revisions times weighted lines", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-05-01T12:00:00Z", {
        "src/hot.ts": deep,
        "src/calm.ts": deep,
        "src/mid.ts": shallow,
        "src/flat.ts": flat,
      });
      for (const count of [2, 3, 4]) {
        yield* repo.commit(`2026-05-0${count}T12:00:00Z`, {
          "src/hot.ts": revision(deep, count),
          "src/mid.ts": revision(shallow, count),
          "src/flat.ts": revision(flat, count),
        });
      }

      const report = yield* analyze(analyzeOptionsFor(repo));

      // revisions 4/4/4/1; weighted lines (loc + indentation) 10+9, 6+1, 5+0, 7+9.
      // Each log-max normalized: hot 1 * 1, mid 1 * log(8)/log(20),
      // flat 1 * log(6)/log(20), calm log(2)/log(5) * log(17)/log(20).
      assert.deepStrictEqual(
        report.files.map(({ path, rank, revisions }) => [
          path,
          rank,
          revisions,
        ]),
        [
          ["src/hot.ts", 1, 4],
          ["src/mid.ts", 2, 4],
          ["src/flat.ts", 3, 4],
          ["src/calm.ts", 4, 1],
        ],
      );
      assert.strictEqual(report.files[0]?.score, 1);
      assert.approximately(report.files[1]?.score ?? 0, 0.6941, 0.0001);
      assert.approximately(report.files[2]?.score ?? 0, 0.5981, 0.0001);
      assert.approximately(report.files[3]?.score ?? 0, 0.4073, 0.0001);
      assert.strictEqual(report.files[0]?.complexity.total, 9);
      assert.strictEqual(report.totals.files, 4);
    }),
  );
});

layer(NodeServices.layer)("analyze report", (it) => {
  it.effect(
    "describes the repository and tool and satisfies the Report schema",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-05-01T12:00:00Z", { "a.ts": "a\n" });
        const head = (yield* repo.git("rev-parse", "HEAD")).trim();

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          yield* Schema.decodeEffect(Report)(report),
          report,
        );
        assert.deepStrictEqual(report.tool, {
          name: "codeheat",
          version: "0.0.0-test",
        });
        assert.deepStrictEqual(
          [
            report.repository.head,
            report.repository.scope,
            report.schemaVersion,
          ],
          [head, ".", 1],
        );
        assert.deepStrictEqual(report.thresholds, {
          maxCommitFiles: 50,
          hubMinBreadth: 10,
          hubMinRevisions: 5,
          hubTopShare: 0.05,
          minModuleCommits: 5,
          minLocalDistance: 3,
          minCliqueShare: 0.3,
          minFanIn: 5,
          minInterfaceChanges: 5,
          minVolatilityRatio: 2,
          minHiddenProbability: 0.5,
          minCopySimilarity: 0.5,
          minLeakage: 0.5,
          minImplementationCommits: 5,
          minSharedCommits: 3,
          minDegree: 0.3,
          propagationDepth: 3,
          ubiquitousShare: 0.3,
          ubiquitousMinCommits: 10,
          maxMeanLineLength: 300,
          maxFileBytes: 1_048_576,
        });
      }),
  );
});

layer(NodeServices.layer)("analyze coupling", (it) => {
  it.effect(
    "reports a pair that changes together in enough commits as coupled",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-05-01T12:00:00Z", {
          "a.ts": "1\n",
          "b.ts": "1\n",
          "c.ts": "1\n",
        });
        yield* repo.commit("2026-05-02T12:00:00Z", {
          "a.ts": "2\n",
          "b.ts": "2\n",
        });
        yield* repo.commit("2026-05-03T12:00:00Z", {
          "a.ts": "3\n",
          "b.ts": "3\n",
        });
        yield* repo.commit("2026-05-04T12:00:00Z", { "a.ts": "4\n" });
        yield* repo.commit("2026-05-05T12:00:00Z", { "c.ts": "5\n" });

        const report = yield* analyze(analyzeOptionsFor(repo));

        // a.ts changed in 4 commits, b.ts in 3, and 3 changed both: 3 / mean(4, 3)
        assert.strictEqual(report.couplings.length, 1);
        const [coupling] = report.couplings;
        assert.deepStrictEqual(
          [
            coupling?.a,
            coupling?.b,
            coupling?.sharedCommits,
            coupling?.distance,
            coupling?.testPair,
          ],
          ["a.ts", "b.ts", 3, 0, false],
        );
        assert.strictEqual(coupling?.degree, 0.8571);
        assert.strictEqual(report.totals.couplings, 1);
        assert.deepStrictEqual(
          report.files[0]?.reasons.at(-1),
          "co-changes with b.ts in 75% of its changes",
        );
      }),
  );
});

layer(NodeServices.layer)("analyze commit size", (it) => {
  it.effect(
    "ignores commits above maxCommitFiles for coupling but counts their revisions",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        for (const version of [1, 2, 3]) {
          yield* repo.commit(
            `2026-05-0${version}T12:00:00Z`,
            filesAtVersion(51, version),
          );
        }

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.strictEqual(report.files.length, 51);
        assert.isTrue(report.files.every((file) => file.revisions === 3));
        assert.deepStrictEqual(report.couplings, []);
        assert.deepStrictEqual(
          [report.window.commits, report.window.couplingCommits],
          [3, 0],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze history", (it) => {
  it.effect("counts revisions of a renamed file under its current path", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      const lines = Array.from(
        { length: 10 },
        (_, index) => `line ${index}\n`,
      ).join("");
      yield* repo.commit("2026-05-01T12:00:00Z", { "old.ts": lines });
      yield* repo.git("mv", "old.ts", "new.ts");
      yield* repo.commit("2026-05-02T12:00:00Z");
      yield* repo.commit("2026-05-03T12:00:00Z", {
        "new.ts": `${lines}more\n`,
      });

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(
        report.files.map(({ path, revisions }) => [path, revisions]),
        // creation and the edit; the move adds none
        [["new.ts", 2]],
      );
    }),
  );
});

layer(NodeServices.layer)("analyze window", (it) => {
  it.effect(
    "resolves since against the clock and reports the window bounds",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-02-28T12:00:00Z", { "a.ts": "1\n" });
        yield* repo.commit("2026-04-01T12:00:00Z", { "a.ts": "1\n2\n" });
        yield* repo.commit("2026-07-01T12:00:00Z", { "a.ts": "1\n2\n3\n" });

        const report = yield* analyze(analyzeOptionsFor(repo, { since: "3m" }));

        assert.deepStrictEqual(report.window, {
          since: "2026-03-01T12:00:00.000Z",
          until: "2026-06-01T12:00:00.000Z",
          commits: 1,
          realCommits: 1,
          couplingCommits: 1,
        });
        assert.strictEqual(report.generatedAt, "2026-06-01T12:00:00.000Z");
        assert.deepStrictEqual(
          [report.files[0]?.revisions, report.files[0]?.linesAdded],
          [1, 1],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze scope", (it) => {
  it.effect("limits the universe to files under the given scope", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-05-01T12:00:00Z", {
        "src/a.ts": "a\n",
        "lib/b.ts": "b\n",
      });

      const report = yield* analyze(analyzeOptionsFor(repo, { scope: "src" }));

      assert.deepStrictEqual(
        report.files.map((file) => file.path),
        ["src/a.ts"],
      );
      assert.strictEqual(report.repository.scope, "src");
    }),
  );
});

layer(NodeServices.layer)("analyze scope and history", (it) => {
  it.effect("keeps the history from before a move into the scope", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      const content = Array.from({ length: 10 }, (_, i) => `line ${i}\n`).join(
        "",
      );
      yield* repo.commit("2026-04-01T12:00:00Z", { "old/a.ts": content });
      yield* repo.commit("2026-04-02T12:00:00Z", {
        "old/a.ts": `${content}two\n`,
      });
      // identical content at the new path lets git detect the move
      yield* repo.git("rm", "--quiet", "old/a.ts");
      yield* repo.commit("2026-04-03T12:00:00Z", {
        "pkg/a.ts": `${content}two\n`,
      });
      yield* repo.commit("2026-04-04T12:00:00Z", {
        "pkg/a.ts": `${content}two\nthree\n`,
      });

      const scoped = yield* analyze(analyzeOptionsFor(repo, { scope: "pkg" }));
      const whole = yield* analyze(analyzeOptionsFor(repo));

      // creation, edit, and edit after the move; the move changes no content
      assert.strictEqual(scoped.files[0]?.revisions, 3);
      assert.strictEqual(whole.files[0]?.revisions, 3);
    }),
  );

  it.effect(
    "analyzes the whole repository from a subdirectory cwd without scope",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-05-01T12:00:00Z", {
          "src/a.ts": "a\n",
          "lib/b.ts": "b\n",
        });

        const report = yield* analyze(
          analyzeOptionsFor(repo, { cwd: `${repo.directory}/src` }),
        );

        assert.deepStrictEqual(
          report.files.map((file) => file.path),
          ["lib/b.ts", "src/a.ts"],
        );
        assert.strictEqual(report.repository.scope, ".");
      }),
  );
});
