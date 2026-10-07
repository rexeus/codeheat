import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { makeTempRepository } from "../testing/temp-repository.js";
import { Git } from "./git.js";
import { readRepositoryName } from "./repository-name.js";

const nameIn = (directory: string) =>
  readRepositoryName.pipe(Effect.provide(Git.layer(directory)));

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
});
