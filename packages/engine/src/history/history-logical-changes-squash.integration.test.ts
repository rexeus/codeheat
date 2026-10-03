import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
  lines,
  mergePullRequest,
  mergeRefs,
  pathsOfChanges,
  readChanges,
  startOn,
} from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";

layer(NodeServices.layer)(
  "readHistory squash-merged features on develop",
  (it) => {
    it.effect(
      "leaves the commits of an Azure DevOps release pull request ungrouped",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          const universe = ["a.ts", "b.ts", "c.ts"];
          yield* startOn(repo, universe);
          yield* repo.git("checkout", "--quiet", "-b", "develop", "main");
          for (const [index, file] of universe.entries()) {
            yield* repo.commit(
              `2026-03-0${index + 1}T12:00:00Z`,
              { [file]: lines(4, file) },
              `Merged PR ${11 + index}: change ${file}`,
            );
          }
          yield* repo.git("checkout", "--quiet", "main");
          yield* mergeRefs(
            repo,
            "2026-03-05T12:00:00Z",
            ["develop"],
            ["Merged PR 14: Release 1"],
          );

          const result = yield* readChanges(repo, universe);

          assert.deepStrictEqual(pathsOfChanges(result), [
            ["a.ts"],
            ["b.ts"],
            ["c.ts"],
          ]);
          assert.strictEqual(result.logicalChanges.by, "commit");
        }),
    );
  },
);

layer(NodeServices.layer)("readHistory merges inside a pull request", (it) => {
  it.effect(
    "keeps the commits a git pull brought into a pull request's branch with it",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const universe = ["a.ts", "b.ts", "c.ts"];
        yield* startOn(repo, universe);
        yield* repo.git("checkout", "--quiet", "-b", "feature", "main");
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": lines(4, "a") });
        yield* repo.git("checkout", "--quiet", "-b", "remote", "feature");
        yield* repo.commit("2026-03-02T12:00:00Z", { "b.ts": lines(4, "b") });
        yield* repo.git("checkout", "--quiet", "feature");
        yield* repo.commit("2026-03-03T12:00:00Z", { "c.ts": lines(4, "c") });
        yield* mergeRefs(
          repo,
          "2026-03-04T12:00:00Z",
          ["remote"],
          ["Merge branch 'feature' of github.com:org/repo"],
        );
        yield* repo.git("checkout", "--quiet", "main");
        yield* mergePullRequest(repo, "2026-03-05T12:00:00Z", "feature", 8);

        const result = yield* readChanges(repo, universe);

        assert.deepStrictEqual(pathsOfChanges(result), [
          ["a.ts", "b.ts", "c.ts"],
        ]);
      }),
  );
});
