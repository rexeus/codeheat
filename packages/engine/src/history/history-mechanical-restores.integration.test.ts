import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

const lines = (count: number, edits: Readonly<Record<number, string>> = {}) =>
  Array.from(
    { length: count },
    (_, index) => `${edits[index] ?? `line ${index}`}\n`,
  ).join("");

const read = (repo: TempRepository, universe: ReadonlyArray<string>) =>
  readHistory({
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-12-31T00:00:00.000Z",
    skipCommits: new Set(),
    universe: new Set(universe),
  }).pipe(Effect.provide(Git.layer(repo.directory)));

/**
 * A file with a change that another commit's edit sits on top of, so that
 * reverting the change cannot give the file back an object it had: only the
 * patches show it is an undo. Returns the file's revisions and the reverts.
 */
const revertUnderLaterEdit = (repo: TempRepository, path: string) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-01T12:00:00Z", { [path]: lines(10) });
    yield* repo.commit("2026-03-02T12:00:00Z", {
      [path]: lines(10, { 2: "x" }),
    });
    const change = (yield* repo.git("rev-parse", "HEAD")).trim();
    yield* repo.commit("2026-03-03T12:00:00Z", {
      [path]: lines(10, { 2: "x", 8: "y" }),
    });
    yield* repo.gitAt("2026-03-04T12:00:00Z", "revert", "--no-edit", change);
    const result = yield* read(repo, [path]);
    return {
      revisions: result.files.get(path)?.revisions,
      reverts: result.mechanical.reverts,
    };
  });

layer(NodeServices.layer)(
  "readHistory reverts confirmed by their patch",
  (it) => {
    it.effect(
      "pairs a revert of a change that a later commit edited around",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;

          const result = yield* revertUnderLaterEdit(repo, "a.ts");

          // the creation and the later edit; the change and its revert cancel out
          assert.deepStrictEqual(result, { revisions: 2, reverts: 2 });
        }),
    );

    it.effect(
      "pairs it under a user's color, prefix, and diff tool settings",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.git("config", "diff.noprefix", "true");
          yield* repo.git("config", "diff.mnemonicPrefix", "true");
          yield* repo.git("config", "color.ui", "always");
          yield* repo.git("config", "diff.suppressBlankEmpty", "true");
          yield* repo.git("config", "diff.external", "/nonexistent/tool");

          const result = yield* revertUnderLaterEdit(repo, "a.ts");

          assert.deepStrictEqual(result, { revisions: 2, reverts: 2 });
        }),
    );

    it.effect("pairs it for paths git quotes", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;

        const quote = yield* revertUnderLaterEdit(repo, 'q"z.ts');
        const tab = yield* revertUnderLaterEdit(
          yield* makeTempRepository,
          "t\tz.ts",
        );

        assert.deepStrictEqual(quote, { revisions: 2, reverts: 2 });
        assert.deepStrictEqual(tab, { revisions: 2, reverts: 2 });
      }),
    );
  },
);

const latin1 = (accent: number) => Uint8Array.from([99, 97, 102, accent, 10]);

layer(NodeServices.layer)(
  "readHistory reverts of text that is not UTF-8",
  (it) => {
    it.effect(
      "pairs an exact revert of a Latin-1 change through the object ids",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": latin1(0xe9) });
          yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": latin1(0xe8) });
          yield* repo.gitAt(
            "2026-03-03T12:00:00Z",
            "revert",
            "--no-edit",
            "HEAD",
          );

          const result = yield* read(repo, ["a.ts"]);

          assert.strictEqual(result.mechanical.reverts, 2);
        }),
    );

    it.effect(
      "counts a revert of a Latin-1 change that restores another character",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": latin1(0xe9) });
          yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": latin1(0xe8) });
          const change = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            { "a.ts": latin1(0xe7) },
            `Revert it\n\nThis reverts commit ${change}.\n`,
          );

          const result = yield* read(repo, ["a.ts"]);

          assert.strictEqual(result.mechanical.reverts, 0);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 3);
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory reverts of a commit with a huge lockfile",
  (it) => {
    it.effect(
      "pairs a revert that regenerates a lockfile of 70 000 lines",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": lines(10),
            "package-lock.json": lines(70_000),
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": lines(10, { 2: "x" }),
            "package-lock.json": lines(70_000, { 5: "bumped" }),
          });
          const change = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.git("revert", "--no-commit", change);
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            {
              "package-lock.json": lines(70_000, {
                6: "regenerated",
                7: "again",
              }),
            },
            `Revert it\n\nThis reverts commit ${change}.\n`,
          );

          const result = yield* read(repo, ["a.ts"]);

          assert.strictEqual(result.mechanical.reverts, 2);
        }),
    );
  },
);

/**
 * The original is dated after the revert that undoes it and reached first,
 * through a merge, so the scan reads it before the revert that names it.
 * `revert` makes the revert commit, dated before the original.
 */
const revertDatedBeforeItsOriginal = (
  repo: TempRepository,
  revert: (original: string) => Effect.Effect<void>,
) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": lines(10) });
    yield* repo.commit("2026-03-09T12:00:00Z", {
      "a.ts": lines(10, { 2: "x" }),
    });
    const original = (yield* repo.git("rev-parse", "HEAD")).trim();
    yield* revert(original);
    yield* repo.git("checkout", "--quiet", "-b", "side", original);
    yield* repo.commit("2026-03-10T12:00:00Z", { "b.ts": lines(3) });
    yield* repo.git("checkout", "--quiet", "-");
    yield* repo.gitAt("2026-03-11T12:00:00Z", "merge", "--no-edit", "side");
    return (yield* read(repo, ["a.ts", "b.ts"])).mechanical.reverts;
  });

layer(NodeServices.layer)(
  "readHistory reverts that are read before their original",
  (it) => {
    it.effect("pairs an exact revert through the patches", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;

        const reverts = yield* revertDatedBeforeItsOriginal(repo, (original) =>
          repo
            .gitAt("2026-03-02T12:00:00Z", "revert", "--no-edit", original)
            .pipe(Effect.asVoid),
        );

        assert.strictEqual(reverts, 2);
      }),
    );

    it.effect(
      "counts a revert with the same line counts but other content",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;

          const reverts = yield* revertDatedBeforeItsOriginal(
            repo,
            (original) =>
              repo.commit(
                "2026-03-02T12:00:00Z",
                { "a.ts": lines(10, { 2: "z" }) },
                `Revert it\n\nThis reverts commit ${original}.\n`,
              ),
          );

          assert.strictEqual(reverts, 0);
        }),
    );
  },
);

layer(NodeServices.layer)("readHistory reverts of a change of type", (it) => {
  it.effect("counts a revert that turns a symlink back into a file", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "a.ts": lines(2),
        "target.txt": "b.ts",
      });
      const target = (yield* repo.git("rev-parse", "HEAD:target.txt")).trim();
      yield* repo.git("update-index", "--cacheinfo", `120000,${target},a.ts`);
      yield* repo.gitAt("2026-03-02T12:00:00Z", "commit", "-m", "to symlink");
      yield* repo.git("checkout", "--", "a.ts");
      yield* repo.gitAt("2026-03-03T12:00:00Z", "revert", "--no-edit", "HEAD");

      const result = yield* read(repo, ["a.ts"]);

      assert.strictEqual(result.mechanical.reverts, 0);
    }),
  );
});
