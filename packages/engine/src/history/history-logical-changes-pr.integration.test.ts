import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import {
  lines,
  mergeBranch,
  pathsOfChanges,
  readChanges,
  startOn,
} from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { readHistoryHalves } from "./history.js";

layer(NodeServices.layer)("readHistory logical changes by suffix", (it) => {
  it.effect("joins commits that end with the same pull request number", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* startOn(repo, ["a.ts", "b.ts", "c.ts"]);
      yield* repo.commit(
        "2026-03-01T12:00:00Z",
        { "a.ts": lines(4, "a1") },
        "feat: first half (#12)",
      );
      yield* repo.commit(
        "2026-03-02T12:00:00Z",
        { "b.ts": lines(4, "b1") },
        "feat: second half (#12)",
      );
      yield* repo.commit(
        "2026-03-03T12:00:00Z",
        { "c.ts": lines(4, "c1") },
        "fix: another one (#13)",
      );

      const result = yield* readChanges(repo, ["a.ts", "b.ts", "c.ts"]);

      assert.deepStrictEqual(pathsOfChanges(result), [
        ["a.ts", "b.ts"],
        ["c.ts"],
      ]);
      assert.deepStrictEqual(result.logicalChanges, {
        by: "pr",
        count: 2,
        largest: 2,
      });
      assert.strictEqual(result.commits.length, 3);
      assert.strictEqual(result.files.get("a.ts")?.revisions, 1);
    }),
  );
});

layer(NodeServices.layer)("readHistory logical changes at the edges", (it) => {
  it.effect("cuts a pull request at the split between two windows", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* startOn(repo, ["a.ts", "b.ts"]);
      yield* repo.commit(
        "2026-03-01T12:00:00Z",
        { "a.ts": lines(4, "a1") },
        "feat: x (#5)",
      );
      yield* repo.commit(
        "2026-04-01T12:00:00Z",
        { "b.ts": lines(4, "b1") },
        "feat: y (#5)",
      );

      const { recent, earlier } = yield* readHistoryHalves(
        {
          since: "2026-01-01T00:00:00.000Z",
          until: "2026-12-31T00:00:00.000Z",
          skipCommits: new Set(),
          universe: new Set(["a.ts", "b.ts"]),
        },
        Date.parse("2026-03-15T00:00:00Z") / 1000,
      ).pipe(Effect.provide(Git.layer(repo.directory)));

      assert.deepStrictEqual(pathsOfChanges(recent), [["b.ts"]]);
      assert.deepStrictEqual(pathsOfChanges(earlier), [["a.ts"]]);
    }),
  );

  it.effect("groups nothing in a repository without either signal", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* startOn(repo, ["a.ts", "b.ts"]);
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": lines(4, "a1") });
      yield* repo.commit("2026-03-02T12:00:00Z", { "b.ts": lines(4, "b1") });

      const result = yield* readChanges(repo, ["a.ts", "b.ts"]);

      assert.deepStrictEqual(pathsOfChanges(result), [["a.ts"], ["b.ts"]]);
      assert.deepStrictEqual(result.logicalChanges, {
        by: "commit",
        count: 2,
        largest: 1,
      });
    }),
  );
});

layer(NodeServices.layer)("readHistory logical changes by merge", (it) => {
  it.effect("joins the commits of a branch merged with a merge commit", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      const universe = ["a.ts", "b.ts", "c.ts", "d.ts"];
      yield* startOn(repo, universe);
      yield* repo.git("checkout", "--quiet", "-b", "feature");
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": lines(4, "a1") });
      yield* repo.commit("2026-03-02T12:00:00Z", { "b.ts": lines(4, "b1") });
      yield* repo.commit("2026-03-03T12:00:00Z", { "c.ts": lines(4, "c1") });
      yield* repo.git("checkout", "--quiet", "main");
      yield* repo.commit("2026-03-04T12:00:00Z", { "d.ts": lines(4, "d1") });
      yield* mergeBranch(repo, "2026-03-05T12:00:00Z", "feature");

      const result = yield* readChanges(repo, universe);

      assert.deepStrictEqual(pathsOfChanges(result), [
        ["a.ts", "b.ts", "c.ts"],
        ["d.ts"],
      ]);
      assert.deepStrictEqual(result.logicalChanges, {
        by: "pr",
        count: 2,
        largest: 3,
      });
    }),
  );
});

layer(NodeServices.layer)(
  "readHistory logical changes of nested merges",
  (it) => {
    it.effect(
      "keeps a branch merged into another branch apart from the merge of that one",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          const universe = ["a.ts", "b.ts", "c.ts", "d.ts"];
          yield* startOn(repo, universe);
          yield* repo.git("checkout", "--quiet", "-b", "develop");
          yield* repo.git("checkout", "--quiet", "-b", "feature");
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": lines(4, "a1"),
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "b.ts": lines(4, "b1"),
          });
          yield* repo.git("checkout", "--quiet", "develop");
          yield* repo.commit("2026-03-03T12:00:00Z", {
            "c.ts": lines(4, "c1"),
          });
          yield* mergeBranch(repo, "2026-03-04T12:00:00Z", "feature");
          yield* repo.git("checkout", "--quiet", "main");
          yield* repo.commit("2026-03-05T12:00:00Z", {
            "d.ts": lines(5, "d2"),
          });
          yield* mergeBranch(repo, "2026-03-06T12:00:00Z", "develop");

          const result = yield* readChanges(repo, universe);

          // feature (a, b) is one change, develop's own commit (c) another, main's own commit (d) a third
          assert.deepStrictEqual(pathsOfChanges(result), [
            ["a.ts", "b.ts"],
            ["c.ts"],
            ["d.ts"],
          ]);
        }),
    );
  },
);
