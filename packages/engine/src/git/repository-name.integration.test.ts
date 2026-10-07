import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";

import { makeTempRepository } from "../testing/temp-repository.js";
import { Git } from "./git.js";
import { readRepositoryName } from "./repository-name.js";

const nameIn = (directory: string) =>
  readRepositoryName(directory).pipe(Effect.provide(Git.layer(directory)));

/** A git that answers `rev-parse <flag>` with `answers[flag]`, as an old or odd git might. */
const gitAnswering = (answers: Readonly<Record<string, string>>) =>
  Layer.succeed(
    Git,
    Git.of({
      text: (args) => Effect.succeed(answers[args.at(-1) ?? ""] ?? ""),
      stream: () => Stream.empty,
    }),
  );

layer(NodeServices.layer)("readRepositoryName", (it) => {
  it.effect("names the repository after the folder of its work tree", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });

      const name = yield* nameIn(repo.directory);

      assert.strictEqual(name, path.basename(repo.directory));
    }),
  );
});

layer(NodeServices.layer)(
  "readRepositoryName where the git directory lies elsewhere",
  (it) => {
    it.effect(
      "names a linked work tree after the repository, not its own folder",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
          const elsewhere = yield* fs.makeTempDirectoryScoped();
          const worktree = path.join(elsewhere, "feature-branch");
          yield* repo.git("worktree", "add", "--quiet", "-b", "f", worktree);

          const name = yield* nameIn(worktree);

          assert.strictEqual(name, path.basename(repo.directory));
        }),
    );

    it.effect(
      "names a work tree of a bare repository after it, without .git",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
          const elsewhere = yield* fs.makeTempDirectoryScoped();
          const bare = path.join(elsewhere, "shop.git");
          const worktree = path.join(elsewhere, "checkout");
          yield* repo.git("clone", "--quiet", "--bare", repo.directory, bare);
          yield* repo.git(
            "--git-dir",
            bare,
            "worktree",
            "add",
            "--quiet",
            worktree,
          );

          const name = yield* nameIn(worktree);

          assert.strictEqual(name, "shop");
        }),
    );

    it.effect(
      "names a work tree whose git directory is kept elsewhere after its own folder",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repo = yield* makeTempRepository;
          const elsewhere = yield* fs.makeTempDirectoryScoped();
          const store = path.join(elsewhere, "store");
          const work = path.join(elsewhere, "shop");
          yield* repo.git("init", "--quiet", "--separate-git-dir", store, work);

          const name = yield* nameIn(work);

          assert.strictEqual(name, "shop");
        }),
    );
  },
);

layer(NodeServices.layer)("readRepositoryName fallback", (it) => {
  const linked = "/r/.git/worktrees/w\n";
  const cases: ReadonlyArray<{
    readonly does: string;
    readonly answers: Readonly<Record<string, string>>;
  }> = [
    {
      does: "echoes a flag it does not know",
      answers: {
        "--git-dir": linked,
        "--git-common-dir": "--git-common-dir\n",
      },
    },
    {
      does: "prints more than one path",
      answers: { "--git-dir": linked, "--git-common-dir": "/r/.git\n/r\n" },
    },
    { does: "prints nothing", answers: {} },
  ];

  it.effect.each(cases)(
    "keeps the folder of the work tree when git $does",
    ({ answers }) =>
      Effect.gen(function* () {
        const name = yield* readRepositoryName("/work/checkout").pipe(
          Effect.provide(gitAnswering(answers)),
        );

        assert.strictEqual(name, "checkout");
      }),
  );
});
