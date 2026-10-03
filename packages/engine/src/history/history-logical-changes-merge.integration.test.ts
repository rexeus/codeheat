import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
  branchOff,
  mergePullRequest,
  mergeRefs,
  pathsOfChanges,
  readChanges,
  startOn,
} from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";

/** A feature branch of two commits merged with a merge commit that has these paragraphs. */
const mergeFeature = (messages: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const repo = yield* makeTempRepository;
    yield* startOn(repo, ["a.ts", "b.ts"]);
    yield* branchOff(repo, "feature", 1, ["a.ts", "b.ts"]);
    yield* mergeRefs(repo, "2026-03-05T12:00:00Z", ["feature"], messages);
    return yield* readChanges(repo, ["a.ts", "b.ts"]);
  });

layer(NodeServices.layer)("readHistory pull request merge formats", (it) => {
  it.effect("groups the commits of a GitHub pull request merge", () =>
    Effect.gen(function* () {
      const result = yield* mergeFeature([
        "Merge pull request #7 from org/feature",
      ]);

      assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
      assert.strictEqual(result.logicalChanges.by, "pr");
    }),
  );

  it.effect("groups the commits of a Bitbucket pull request merge", () =>
    Effect.gen(function* () {
      const result = yield* mergeFeature([
        "Merged in feature (pull request #7)",
      ]);

      assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
    }),
  );

  it.effect("groups the commits of a GitLab merge request merge", () =>
    Effect.gen(function* () {
      const result = yield* mergeFeature([
        "Merge branch 'feature' into 'main'",
        "See merge request group/project!7",
      ]);

      assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
    }),
  );

  it.effect("groups the commits of an Azure DevOps pull request merge", () =>
    Effect.gen(function* () {
      const result = yield* mergeFeature(["Merged PR 7: Add the feature"]);

      assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
    }),
  );
});

layer(NodeServices.layer)(
  "readHistory merges that are no pull request",
  (it) => {
    it.effect("groups nothing for a plain merge of a branch", () =>
      Effect.gen(function* () {
        const result = yield* mergeFeature(["Merge branch 'feature'"]);

        assert.deepStrictEqual(pathsOfChanges(result), [["a.ts"], ["b.ts"]]);
        assert.strictEqual(result.logicalChanges.by, "commit");
      }),
    );

    it.effect("groups nothing for the merge a git pull makes", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const universe = ["l.ts", "u1.ts", "u2.ts"];
        yield* startOn(repo, universe);
        yield* branchOff(repo, "upstream", 1, ["u1.ts", "u2.ts"]);
        yield* repo.commit("2026-03-04T12:00:00Z", { "l.ts": "local\n" });
        yield* mergeRefs(
          repo,
          "2026-03-05T12:00:00Z",
          ["upstream"],
          ["Merge branch 'main' of github.com:org/repo"],
        );

        const result = yield* readChanges(repo, universe);

        assert.deepStrictEqual(pathsOfChanges(result), [
          ["l.ts"],
          ["u1.ts"],
          ["u2.ts"],
        ]);
      }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory merges of the mainline and of tags",
  (it) => {
    it.effect(
      "groups nothing for a merge of the mainline seen from a feature branch",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          const universe = ["f.ts", "m1.ts", "m2.ts"];
          yield* startOn(repo, universe);
          yield* branchOff(repo, "feature", 1, ["f.ts"]);
          yield* repo.commit("2026-03-02T12:00:00Z", { "m1.ts": "one\n" });
          yield* repo.commit("2026-03-03T12:00:00Z", { "m2.ts": "two\n" });
          yield* repo.git("checkout", "--quiet", "feature");
          yield* mergeRefs(
            repo,
            "2026-03-05T12:00:00Z",
            ["main"],
            ["Merge branch 'main' into feature"],
          );

          const result = yield* readChanges(repo, universe);

          assert.deepStrictEqual(pathsOfChanges(result), [
            ["f.ts"],
            ["m1.ts"],
            ["m2.ts"],
          ]);
        }),
    );

    it.effect("groups nothing for the merge of a tag", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const universe = ["a.ts", "b.ts"];
        yield* startOn(repo, universe);
        yield* branchOff(repo, "side", 1, ["a.ts", "b.ts"]);
        yield* repo.git("tag", "v1", "side");
        yield* repo.git("branch", "--quiet", "-D", "side");
        yield* mergeRefs(
          repo,
          "2026-03-05T12:00:00Z",
          ["v1"],
          ["Merge tag 'v1'"],
        );

        const result = yield* readChanges(repo, universe);

        assert.deepStrictEqual(pathsOfChanges(result), [["a.ts"], ["b.ts"]]);
      }),
    );
  },
);

const octopus = (messages: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const repo = yield* makeTempRepository;
    const universe = ["a.ts", "b.ts", "c.ts", "d.ts"];
    yield* startOn(repo, universe);
    yield* branchOff(repo, "topic1", 1, ["a.ts", "b.ts"]);
    yield* branchOff(repo, "topic2", 3, ["c.ts", "d.ts"]);
    yield* mergeRefs(
      repo,
      "2026-03-06T12:00:00Z",
      ["topic1", "topic2"],
      messages,
    );
    return yield* readChanges(repo, universe);
  });

layer(NodeServices.layer)("readHistory octopus merges", (it) => {
  it.effect("groups nothing for an octopus of unrelated topics", () =>
    Effect.gen(function* () {
      const result = yield* octopus(["Merge branches 'topic1' and 'topic2'"]);

      assert.strictEqual(result.logicalChanges.by, "commit");
      assert.strictEqual(result.changes.length, 4);
    }),
  );

  it.effect("makes each topic of a pull request octopus its own change", () =>
    Effect.gen(function* () {
      const result = yield* octopus(["Merge pull request #3 from org/topics"]);

      assert.deepStrictEqual(pathsOfChanges(result), [
        ["a.ts", "b.ts"],
        ["c.ts", "d.ts"],
      ]);
    }),
  );
});

layer(NodeServices.layer)("readHistory Bitbucket Server merges", (it) => {
  it.effect(
    "groups the commits of a merge in the plain Bitbucket Server format",
    () =>
      Effect.gen(function* () {
        const result = yield* mergeFeature([
          "Merge pull request #7 in PROJ/repo from feature to master",
        ]);

        assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
      }),
  );

  it.effect(
    "groups the commits of a merge that starts with the pull request title",
    () =>
      Effect.gen(function* () {
        const result = yield* mergeFeature([
          "Pull request #7: Add the feature",
          "Merge in PROJ/repo from feature to master",
        ]);

        assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
      }),
  );
});

layer(NodeServices.layer)("readHistory integration branches", (it) => {
  it.effect(
    "leaves the direct commits of a released develop branch ungrouped",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const universe = ["a.ts", "b.ts", "c.ts"];
        yield* startOn(repo, universe);
        yield* branchOff(repo, "develop", 1, universe);
        yield* mergePullRequest(repo, "2026-03-05T12:00:00Z", "develop", 101);

        const result = yield* readChanges(repo, universe);

        assert.deepStrictEqual(pathsOfChanges(result), [
          ["a.ts"],
          ["b.ts"],
          ["c.ts"],
        ]);
        assert.strictEqual(result.logicalChanges.by, "commit");
      }),
  );

  it.effect(
    "does not let a pull request take the older commits of the branch it was merged into",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const universe = ["w.ts", "x.ts", "z.ts"];
        yield* startOn(repo, universe);
        yield* repo.git("checkout", "--quiet", "-b", "develop", "main");
        yield* repo.commit("2026-03-01T12:00:00Z", { "z.ts": "z\n" });
        yield* repo.git("checkout", "--quiet", "-b", "feature", "develop");
        yield* repo.commit("2026-03-02T12:00:00Z", { "x.ts": "x\n" });
        yield* repo.git("checkout", "--quiet", "develop");
        yield* repo.commit("2026-03-03T12:00:00Z", { "w.ts": "w\n" });
        yield* mergePullRequest(repo, "2026-03-04T12:00:00Z", "feature", 11);
        yield* repo.git("checkout", "--quiet", "main");
        yield* mergePullRequest(repo, "2026-03-05T12:00:00Z", "develop", 12);

        const result = yield* readChanges(repo, universe);

        assert.deepStrictEqual(pathsOfChanges(result), [
          ["w.ts"],
          ["x.ts"],
          ["z.ts"],
        ]);
      }),
  );

  it.effect("walks from HEAD even when its merge lies after the window", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* startOn(repo, ["a.ts", "b.ts"]);
      yield* repo.git("checkout", "--quiet", "-b", "feature", "main");
      yield* repo.commit("2026-12-29T12:00:00Z", { "a.ts": "a\n" });
      yield* repo.commit("2026-12-30T12:00:00Z", { "b.ts": "b\n" });
      yield* repo.git("checkout", "--quiet", "main");
      yield* mergePullRequest(repo, "2027-01-05T12:00:00Z", "feature", 4);

      const result = yield* readChanges(repo, ["a.ts", "b.ts"]);

      assert.deepStrictEqual(pathsOfChanges(result), [["a.ts", "b.ts"]]);
    }),
  );
});
