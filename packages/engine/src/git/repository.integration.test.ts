import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { makeTempRepository } from "../testing/temp-repository.js";
import { NotAGitRepository } from "./git-errors.js";
import { Git } from "./git.js";
import {
  readHead,
  readShallowBoundary,
  repositoryRoot,
  repositoryScope,
} from "./repository.js";

layer(NodeServices.layer)("repositoryRoot", (it) => {
  it.effect("finds the work tree root from a subdirectory", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "packages/a/index.ts": "x\n",
      });
      const subdirectory = path.join(repo.directory, "packages", "a");

      const root = yield* repositoryRoot(subdirectory);

      assert.strictEqual(root, yield* fs.realPath(repo.directory));
    }),
  );

  it.effect(
    "fails with NotAGitRepository for a directory outside a work tree",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();

        const failure = yield* Effect.flip(repositoryRoot(directory));

        assert.deepStrictEqual(
          failure,
          new NotAGitRepository({ path: directory }),
        );
      }),
  );

  it.effect(
    "fails with NotAGitRepository for a directory that does not exist",
    () =>
      Effect.gen(function* () {
        const missing = "/nonexistent/codeheat-test";

        const failure = yield* Effect.flip(repositoryRoot(missing));

        assert.deepStrictEqual(
          failure,
          new NotAGitRepository({ path: missing }),
        );
      }),
  );
});

layer(NodeServices.layer)("repositoryScope", (it) => {
  it.effect("resolves a relative scope against cwd to a POSIX path", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "packages/a/index.ts": "x\n",
      });
      const root = yield* fs.realPath(repo.directory);

      const fromRoot = yield* repositoryScope(root, root, "packages/a");
      const fromInside = yield* repositoryScope(
        root,
        path.join(root, "packages"),
        "a",
      );
      const absolute = yield* repositoryScope(
        root,
        root,
        path.join(root, "packages"),
      );
      const atRoot = yield* repositoryScope(
        root,
        path.join(root, "packages"),
        "..",
      );

      assert.deepStrictEqual(
        [fromRoot, fromInside, absolute, atRoot],
        ["packages/a", "packages/a", "packages", "."],
      );
    }),
  );

  it.effect(
    "fails with NotAGitRepository for a scope outside the work tree",
    () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        const root = yield* fs.realPath(repo.directory);

        const failure = yield* Effect.flip(repositoryScope(root, root, ".."));

        assert.deepStrictEqual(
          failure,
          new NotAGitRepository({ path: path.dirname(root) }),
        );
      }),
  );
});

layer(NodeServices.layer)("readHead", (it) => {
  it.effect("reads null as the head of a repository without commits", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;

      const head = yield* readHead.pipe(
        Effect.provide(Git.layer(repo.directory)),
      );

      assert.isNull(head);
    }),
  );

  it.effect("reads the commit HEAD points to", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.txt": "a\n" });
      const expected = (yield* repo.git("rev-parse", "HEAD")).trim();

      const head = yield* readHead.pipe(
        Effect.provide(Git.layer(repo.directory)),
      );

      assert.strictEqual(head, expected);
    }),
  );
});

layer(NodeServices.layer)("readShallowBoundary", (it) => {
  it.effect("is undefined for a complete repository", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });

      const boundary = yield* readShallowBoundary(repo.directory).pipe(
        Effect.provide(Git.layer(repo.directory)),
      );

      assert.isUndefined(boundary);
    }),
  );

  it.effect("names the oldest commit a shallow clone fetched", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "1\n" });
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "2\n" });
      yield* repo.commit("2026-03-03T12:00:00Z", { "a.ts": "3\n" });
      const oldestFetched = (yield* repo.git("rev-parse", "HEAD~1")).trim();
      const clone = `${yield* fs.makeTempDirectoryScoped()}/clone`;
      yield* repo.git(
        "clone",
        "--quiet",
        "--depth",
        "2",
        `file://${repo.directory}`,
        clone,
      );

      const boundary = yield* readShallowBoundary(clone).pipe(
        Effect.provide(Git.layer(clone)),
      );

      assert.deepStrictEqual(boundary, new Set([oldestFetched]));
    }),
  );
});
