import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { setScopedEnv } from "../testing/scoped-env.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

// Ten distinct lines keep a file similar enough for git to detect a rename
// after one appended line.
const tenLines = Array.from(
  { length: 10 },
  (_, index) => `line ${index}\n`,
).join("");

const history = (repo: TempRepository, universe: ReadonlyArray<string>) =>
  readHistory({
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-12-31T00:00:00.000Z",
    skipCommits: new Set(),
    universe: new Set(universe),
  }).pipe(Effect.provide(Git.layer(repo.directory)));

const revisionsOf = (
  repo: TempRepository,
  universe: ReadonlyArray<string>,
  path: string,
) =>
  history(repo, universe).pipe(
    Effect.map((result) => result.files.get(path)?.revisions),
  );

layer(NodeServices.layer)("readHistory names that are free again", (it) => {
  it.effect(
    "keeps the history of a moved file when a stub at its old name is deleted",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "util.ts": tenLines,
          "main.ts": "x\n",
        });
        for (const [day, extra] of [
          ["02", "a\n"],
          ["03", "a\nb\n"],
          ["04", "a\nb\nc\n"],
        ] as const) {
          yield* repo.commit(`2026-03-${day}T12:00:00Z`, {
            "util.ts": `${tenLines}${extra}`,
          });
        }
        yield* repo.git("mv", "util.ts", "lib-util.ts");
        yield* repo.commit("2026-03-05T12:00:00Z");
        yield* repo.commit("2026-03-06T12:00:00Z", { "util.ts": "stub\n" });
        yield* repo.git("rm", "util.ts");
        yield* repo.commit("2026-03-07T12:00:00Z");
        yield* repo.commit("2026-03-08T12:00:00Z", {
          "lib-util.ts": `${tenLines}a\nb\nc\nd\n`,
        });

        // creation, three edits, and the last edit; the move adds none
        assert.strictEqual(
          yield* revisionsOf(repo, ["lib-util.ts", "main.ts"], "lib-util.ts"),
          5,
        );
      }),
  );

  it.effect(
    "starts a stub afresh at the old name of a moved file when it is created again",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "util.ts": tenLines });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "util.ts": `${tenLines}a\n`,
        });
        yield* repo.git("mv", "util.ts", "lib-util.ts");
        yield* repo.commit("2026-03-03T12:00:00Z");
        yield* repo.commit("2026-03-04T12:00:00Z", { "util.ts": "stub\n" });
        yield* repo.git("rm", "util.ts");
        yield* repo.commit("2026-03-05T12:00:00Z");
        yield* repo.commit("2026-03-06T12:00:00Z", { "util.ts": "new\n" });

        const result = yield* history(repo, ["util.ts", "lib-util.ts"]);

        assert.strictEqual(result.files.get("util.ts")?.revisions, 1);
        // creation and edit; the move adds none
        assert.strictEqual(result.files.get("lib-util.ts")?.revisions, 2);
      }),
  );
});

layer(NodeServices.layer)("readHistory deletions that a merge undid", (it) => {
  it.effect(
    "keeps the history of a file that a merge kept although a branch deleted it",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "p.ts": "0\n" });
        yield* repo.commit("2026-03-02T12:00:00Z", { "p.ts": "1\n" });
        yield* repo.commit("2026-03-03T12:00:00Z", { "p.ts": "2\n" });
        yield* repo.git("checkout", "-b", "feat");
        yield* repo.git("rm", "p.ts");
        yield* repo.commit("2026-03-04T12:00:00Z");
        yield* repo.git("checkout", "-");
        yield* repo.commit("2026-03-05T12:00:00Z", { "p.ts": "3\n" });
        // the merge keeps p.ts and, as a merge, is not part of the history
        yield* repo.gitAt(
          "2026-03-06T12:00:00Z",
          "merge",
          "-s",
          "ours",
          "--no-edit",
          "feat",
        );
        yield* repo.commit("2026-03-07T12:00:00Z", { "p.ts": "4\n" });

        // creation, two edits, the deletion on the branch, and the edits on either side of the merge
        assert.strictEqual(yield* revisionsOf(repo, ["p.ts"], "p.ts"), 6);
      }),
  );
});

layer(NodeServices.layer)("readHistory abbreviated object ids", (it) => {
  it.effect(
    "still sees a deletion when git ends abbreviated object ids with an ellipsis",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": tenLines });
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-03-02T12:00:00Z");
        yield* repo.commit("2026-03-03T12:00:00Z", { "a.ts": "new\n" });
        yield* setScopedEnv({ GIT_PRINT_SHA1_ELLIPSIS: "yes" });

        assert.strictEqual(yield* revisionsOf(repo, ["a.ts"], "a.ts"), 1);
      }),
  );
});

layer(NodeServices.layer)("readHistory names created inside a merge", (it) => {
  // G is created at p.ts and moves to z.ts. A merge then adds a p.ts (F) that
  // no other commit shows being created; F is deleted and p.ts created again.
  it.effect(
    "keeps the history of a file that moved away from a name that a merge gave to another file",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "p.ts": tenLines });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "p.ts": `${tenLines}a\n`,
        });
        yield* repo.commit("2026-03-03T12:00:00Z", {
          "p.ts": `${tenLines}a\nb\n`,
        });
        yield* repo.git("mv", "p.ts", "z.ts");
        yield* repo.commit("2026-03-04T12:00:00Z");
        yield* repo.git("checkout", "-b", "feat");
        yield* repo.commit("2026-03-05T12:00:00Z", { "other.ts": "o\n" });
        yield* repo.git("checkout", "-");
        yield* repo.git("merge", "--no-commit", "--no-ff", "feat");
        yield* repo.commit("2026-03-06T12:00:00Z", { "p.ts": "f\n" });
        yield* repo.git("rm", "p.ts");
        yield* repo.commit("2026-03-07T12:00:00Z");
        yield* repo.commit("2026-03-08T12:00:00Z", { "p.ts": "h\n" });

        const result = yield* history(repo, ["z.ts", "p.ts"]);

        // creation and two edits; the move adds none
        assert.strictEqual(result.files.get("z.ts")?.revisions, 3);
        assert.strictEqual(result.files.get("p.ts")?.revisions, 1);
      }),
  );

  // A branch deletes p.ts and a merge keeps it; a normal commit deletes it later.
  it.effect(
    "keeps a file dead although a deletion that a merge undid lies between its commits",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "p.ts": "0\n" });
        yield* repo.commit("2026-03-02T12:00:00Z", { "p.ts": "1\n" });
        yield* repo.git("checkout", "-b", "feat");
        yield* repo.git("rm", "p.ts");
        yield* repo.commit("2026-03-03T12:00:00Z");
        yield* repo.git("checkout", "-");
        yield* repo.commit("2026-03-04T12:00:00Z", { "other.ts": "o\n" });
        yield* repo.gitAt(
          "2026-03-05T12:00:00Z",
          "merge",
          "-s",
          "ours",
          "--no-edit",
          "feat",
        );
        yield* repo.git("rm", "p.ts");
        yield* repo.commit("2026-03-06T12:00:00Z");
        yield* repo.commit("2026-03-07T12:00:00Z", { "p.ts": "new\n" });

        assert.strictEqual(yield* revisionsOf(repo, ["p.ts"], "p.ts"), 1);
      }),
  );
});

layer(NodeServices.layer)("readHistory restored files", (it) => {
  it.effect("continues a file whose deletion was reverted", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "p.ts": "0\n" });
      yield* repo.commit("2026-03-02T12:00:00Z", { "p.ts": "1\n" });
      yield* repo.git("rm", "p.ts");
      yield* repo.commit("2026-03-03T12:00:00Z");
      yield* repo.gitAt("2026-03-04T12:00:00Z", "revert", "--no-edit", "HEAD");
      yield* repo.commit("2026-03-05T12:00:00Z", { "p.ts": "2\n" });

      // creation, edit, and the last edit; the deletion and its revert cancel out
      assert.strictEqual(yield* revisionsOf(repo, ["p.ts"], "p.ts"), 3);
    }),
  );

  it.effect("continues a file that is reverted and then landed again", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "other.ts": "o\n" });
      yield* repo.commit("2026-03-02T12:00:00Z", { "p.ts": "x\n" });
      yield* repo.gitAt("2026-03-03T12:00:00Z", "revert", "--no-edit", "HEAD");
      yield* repo.gitAt("2026-03-04T12:00:00Z", "revert", "--no-edit", "HEAD");
      yield* repo.commit("2026-03-05T12:00:00Z", { "p.ts": "y\n" });

      // creation and the edit; the revert and the revert of the revert cancel out
      assert.strictEqual(yield* revisionsOf(repo, ["p.ts"], "p.ts"), 2);
    }),
  );
});

layer(NodeServices.layer)("readHistory files that come back", (it) => {
  it.effect(
    "starts afresh when an empty file comes back as an empty file",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "pkg/__init__.py": "",
          "pkg/old.py": "0\n",
        });
        for (const day of ["02", "03", "04"]) {
          yield* repo.commit(`2026-03-${day}T12:00:00Z`, {
            "pkg/old.py": `${day}\n`,
          });
        }
        yield* repo.git("rm", "-r", "pkg");
        yield* repo.commit("2026-03-05T12:00:00Z");
        yield* repo.commit("2026-03-06T12:00:00Z", {
          "pkg/__init__.py": "",
          "pkg/new.py": "n\n",
        });

        assert.strictEqual(
          yield* revisionsOf(
            repo,
            ["pkg/__init__.py", "pkg/new.py"],
            "pkg/__init__.py",
          ),
          1,
        );
      }),
  );

  it.effect("starts afresh when the file comes back with other content", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "p.ts": "x\n" });
      yield* repo.git("rm", "p.ts");
      yield* repo.commit("2026-03-02T12:00:00Z");
      yield* repo.commit("2026-03-03T12:00:00Z", { "p.ts": "y\n" });

      assert.strictEqual(yield* revisionsOf(repo, ["p.ts"], "p.ts"), 1);
    }),
  );
});

layer(NodeServices.layer)("readHistory restored dead files", (it) => {
  // x is created, deleted, restored, deleted, and then created as y: the restored file is the dead one
  it.effect("keeps a restored file dead when it is deleted again", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      for (const [day, content] of [
        ["01", "x\n"],
        ["03", "x\n"],
        ["05", "y\n"],
      ] as const) {
        yield* repo.commit(`2026-03-${day}T12:00:00Z`, { "p.ts": content });
        if (content === "x\n") {
          yield* repo.git("rm", "p.ts");
          yield* repo.commit(`2026-03-${day}T18:00:00Z`);
        }
      }

      assert.strictEqual(yield* revisionsOf(repo, ["p.ts"], "p.ts"), 1);
    }),
  );
});
