import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import type { Module } from "../report/module.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

/**
 * packages/b's entry point x.ts changes with packages/a's a.ts in three
 * commits, is deleted, and is created again together with b.ts:
 *
 * 1-3: a.ts, x.ts (the dead file)   4: rm x.ts   5: b.ts, x.ts (new)   6: b.ts
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2024-01-01T12:00:00Z", {
      "packages/a/package.json": '{ "name": "a" }\n',
      "packages/b/package.json": '{ "name": "b", "main": "x.ts" }\n',
      "packages/a/a.ts": "0\n",
      "packages/b/b.ts": "0\n",
      "packages/b/x.ts": "0\n",
    });
    for (const day of [2, 3, 4]) {
      yield* repo.commit(`2026-05-0${day}T12:00:00Z`, {
        "packages/a/a.ts": `${day}\n`,
        "packages/b/x.ts": `${day}\n`,
      });
    }
    yield* repo.git("rm", "packages/b/x.ts");
    yield* repo.commit("2026-05-05T12:00:00Z");
    yield* repo.commit("2026-05-06T12:00:00Z", {
      "packages/b/b.ts": "6\n",
      "packages/b/x.ts": "new\n",
    });
    yield* repo.commit("2026-05-07T12:00:00Z", { "packages/b/b.ts": "7\n" });
  });

const measuredBy = (module: Module) => ({
  path: module.path,
  commits: module.commits,
  localCommits: module.localCommits,
  cohesion: module.cohesion,
  partners: module.partners,
  interfaceCommits: module.interfaceCommits,
  implementationCommits: module.implementationCommits,
  leakage: module.leakage,
});

// a: its three commits, all local. b: the recreation of x.ts with b.ts, and b.ts alone.
const expectedModules = [
  {
    path: "packages/a",
    commits: 3,
    localCommits: 3,
    cohesion: 1,
    partners: [],
    interfaceCommits: 0,
    implementationCommits: 3,
    leakage: null,
  },
  {
    path: "packages/b",
    commits: 2,
    localCommits: 2,
    cohesion: 1,
    partners: [],
    interfaceCommits: 1,
    implementationCommits: 2,
    leakage: 0.5,
  },
];

layer(NodeServices.layer)("analyze recreated paths in modules", (it) => {
  it.effect(
    "measures modules from the files that exist today, not from the file deleted at a path",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.modules
            .toSorted((x, y) => x.path.localeCompare(y.path))
            .map((module) => measuredBy(module)),
          expectedModules,
        );
        assert.deepStrictEqual(report.couplings, []);
      }),
  );

  it.effect(
    "counts a commit that only touched a deleted file in the window",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.strictEqual(report.window.commits, 6);
      }),
  );
});
