import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { GitNotFound, NotAGitRepository } from "../git/git-errors.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { setScopedEnv } from "../testing/scoped-env.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { InvalidSince } from "./analysis-window.js";
import { analyze } from "./analyze.js";

layer(NodeServices.layer)("analyze failures", (it) => {
  it.effect("reports a null head for a repository without commits", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.isNull(report.repository.head);
      assert.deepStrictEqual(report.files, []);
      assert.strictEqual(report.window.commits, 0);
    }),
  );

  it.effect("fails with NotAGitRepository outside a git work tree", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      const failure = yield* Effect.flip(
        analyze(analyzeOptionsFor({ directory })),
      );

      assert.deepStrictEqual(
        failure,
        new NotAGitRepository({ path: directory }),
      );
    }),
  );

  it.effect("fails with GitNotFound when git is not on PATH", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* setScopedEnv({ PATH: "" });

      const failure = yield* Effect.flip(analyze(analyzeOptionsFor(repo)));

      assert.deepStrictEqual(failure, new GitNotFound());
    }),
  );

  it.effect("fails with InvalidSince for an unparseable since value", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;

      const failure = yield* Effect.flip(
        analyze(analyzeOptionsFor(repo, { since: "last week" })),
      );

      assert.deepStrictEqual(failure, new InvalidSince({ input: "last week" }));
    }),
  );
});
