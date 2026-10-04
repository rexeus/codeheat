import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

layer(NodeServices.layer)("analyze window.lastCommitAt", (it) => {
  it.effect(
    "names the newest commit of the repository, whatever the window holds",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2025-03-14T12:30:00Z", { "a.ts": "1\n" });
        yield* repo.commit("2025-09-02T09:00:00Z", { "a.ts": "1\n2\n" });

        const report = yield* analyze(analyzeOptionsFor(repo, { since: "3m" }));

        assert.strictEqual(report.window.commits, 0);
        assert.strictEqual(
          report.window.lastCommitAt,
          "2025-09-02T09:00:00.000Z",
        );
      }),
  );

  it.effect("is the newest commit when the window holds changes too", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-02-28T12:00:00Z", { "a.ts": "1\n" });
      yield* repo.commit("2026-05-20T18:45:00Z", { "a.ts": "1\n2\n" });

      const report = yield* analyze(analyzeOptionsFor(repo, { since: "3m" }));

      assert.strictEqual(report.window.commits, 1);
      assert.strictEqual(
        report.window.lastCommitAt,
        "2026-05-20T18:45:00.000Z",
      );
    }),
  );

  it.effect("is null for a repository without commits", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.isNull(report.window.lastCommitAt);
    }),
  );
});
