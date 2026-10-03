import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory, readHistoryHalves } from "./history.js";
import type { History, HistoryOptions } from "./history.js";

// Ten distinct lines keep a file similar enough for git to detect a rename
// after one appended line.
const tenLines = Array.from(
  { length: 10 },
  (_, index) => `line ${index}\n`,
).join("");

const history = (
  repo: TempRepository,
  options: Partial<HistoryOptions> & Pick<HistoryOptions, "universe">,
) =>
  readHistory({
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-12-31T00:00:00.000Z",
    skipCommits: new Set(),
    ...options,
  }).pipe(Effect.provide(Git.layer(repo.directory)));

/** Each commit's touched paths, sorted. */
const pathsOfCommits = (result: History): Array<Array<string>> =>
  result.commits.map(({ files }) =>
    Array.from(files, (id) => result.paths[id] ?? "").toSorted(),
  );

/** a.ts is created, edited, renamed to b.ts, edited, renamed to c.ts, edited. */
const commitRenamedTwice = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-01T12:00:00Z", {
      "a.ts": tenLines,
      "other.ts": "x\n",
    });
    yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": `${tenLines}two\n` });
    yield* repo.git("mv", "a.ts", "b.ts");
    yield* repo.commit("2026-03-03T12:00:00Z");
    yield* repo.commit("2026-03-04T12:00:00Z", {
      "b.ts": `${tenLines}two\nfour\n`,
    });
    yield* repo.git("mv", "b.ts", "c.ts");
    yield* repo.commit("2026-03-05T12:00:00Z");
    yield* repo.commit("2026-03-06T12:00:00Z", {
      "c.ts": `${tenLines}two\nfour\nsix\n`,
    });
  });

layer(NodeServices.layer)("readHistory", (it) => {
  it.effect(
    "keeps every revision of a file renamed twice under its current name",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitRenamedTwice(repo);

        const result = yield* history(repo, {
          universe: new Set(["c.ts", "other.ts"]),
        });

        // creation and three edits; the two renames keep every byte and add none
        assert.deepStrictEqual(result.files.get("c.ts"), {
          revisions: 4,
          linesAdded: 13,
          linesDeleted: 0,
        });
        assert.deepStrictEqual(result.files.get("other.ts"), {
          revisions: 1,
          linesAdded: 1,
          linesDeleted: 0,
        });
      }),
  );

  it.effect("lists the universe paths of each commit, newest first", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitRenamedTwice(repo);

      const result = yield* history(repo, {
        universe: new Set(["c.ts", "other.ts"]),
      });

      assert.deepStrictEqual(pathsOfCommits(result), [
        ["c.ts"],
        ["c.ts"],
        ["c.ts"],
        ["c.ts"],
        ["c.ts"],
        ["c.ts", "other.ts"],
      ]);
    }),
  );
});

layer(NodeServices.layer)("readHistory lives of a path", (it) => {
  it.effect(
    "starts a recreated path afresh and still counts the dead file's commits",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": tenLines });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "a.ts": `${tenLines}two\n`,
        });
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-03-03T12:00:00Z");
        yield* repo.commit("2026-03-04T12:00:00Z", { "a.ts": "new\n" });
        yield* repo.commit("2026-03-05T12:00:00Z", { "a.ts": "new\nmore\n" });

        const result = yield* history(repo, { universe: new Set(["a.ts"]) });

        assert.deepStrictEqual(result.files.get("a.ts"), {
          revisions: 2,
          linesAdded: 2,
          linesDeleted: 0,
        });
        assert.deepStrictEqual(pathsOfCommits(result), [
          ["a.ts"],
          ["a.ts"],
          [],
          [],
          [],
        ]);
      }),
  );

  it.effect("treats deleting and adding a path in one commit as an edit", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": tenLines });
      yield* repo.git("rm", "a.ts");
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "replaced\n" });

      const result = yield* history(repo, { universe: new Set(["a.ts"]) });

      assert.deepStrictEqual(result.files.get("a.ts"), {
        revisions: 2,
        linesAdded: 11,
        linesDeleted: 10,
      });
    }),
  );
});

layer(NodeServices.layer)("readHistory lives of a path and renames", (it) => {
  it.effect(
    "starts a path at the file renamed onto it after the deletion",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "dead\n" });
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-03-02T12:00:00Z");
        yield* repo.commit("2026-03-03T12:00:00Z", { "b.ts": tenLines });
        yield* repo.git("mv", "b.ts", "a.ts");
        yield* repo.commit("2026-03-04T12:00:00Z");

        const result = yield* history(repo, { universe: new Set(["a.ts"]) });

        // b.ts's creation; its move onto a.ts adds none
        assert.deepStrictEqual(result.files.get("a.ts"), {
          revisions: 1,
          linesAdded: 10,
          linesDeleted: 0,
        });
      }),
  );

  it.effect(
    "keeps the history of a file created before the deletion of the path it is renamed onto",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "b.ts": tenLines });
        yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "dead\n" });
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-03-03T12:00:00Z");
        yield* repo.git("mv", "b.ts", "a.ts");
        yield* repo.commit("2026-03-04T12:00:00Z");

        const result = yield* history(repo, { universe: new Set(["a.ts"]) });

        // b.ts's creation, not its rename; the dead a.ts is a different file
        assert.deepStrictEqual(result.files.get("a.ts"), {
          revisions: 1,
          linesAdded: 10,
          linesDeleted: 0,
        });
      }),
  );
});

layer(NodeServices.layer)(
  "readHistory lives of a path by the name it had",
  (it) => {
    it.effect(
      "ends a renamed file's history with its deletion under the new name",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "q.ts": tenLines });
          yield* repo.git("mv", "q.ts", "p.ts");
          yield* repo.commit("2026-03-02T12:00:00Z");
          yield* repo.git("rm", "p.ts");
          yield* repo.commit("2026-03-03T12:00:00Z");
          yield* repo.commit("2026-03-04T12:00:00Z", { "p.ts": "new\n" });

          const result = yield* history(repo, { universe: new Set(["p.ts"]) });

          assert.deepStrictEqual(result.files.get("p.ts"), {
            revisions: 1,
            linesAdded: 1,
            linesDeleted: 0,
          });
        }),
    );

    it.effect(
      "keeps a recreated file's history when it is renamed afterwards",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "p.ts": "dead\n" });
          yield* repo.git("rm", "p.ts");
          yield* repo.commit("2026-03-02T12:00:00Z");
          yield* repo.commit("2026-03-03T12:00:00Z", { "p.ts": tenLines });
          yield* repo.git("mv", "p.ts", "r.ts");
          yield* repo.commit("2026-03-04T12:00:00Z");

          const result = yield* history(repo, { universe: new Set(["r.ts"]) });

          assert.deepStrictEqual(result.files.get("r.ts"), {
            revisions: 1,
            linesAdded: 10,
            linesDeleted: 0,
          });
        }),
    );
  },
);

layer(NodeServices.layer)("readHistory universe and window", (it) => {
  it.effect("drops paths outside the universe", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitRenamedTwice(repo);

      const result = yield* history(repo, { universe: new Set(["other.ts"]) });

      assert.deepStrictEqual([...result.files.keys()], ["other.ts"]);
      assert.deepStrictEqual(pathsOfCommits(result), [["other.ts"]]);
    }),
  );

  it.effect("reads only commits inside the window", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitRenamedTwice(repo);

      const result = yield* history(repo, {
        since: "2026-03-04T00:00:00.000Z",
        until: "2026-03-05T23:59:59.000Z",
        universe: new Set(["c.ts", "b.ts"]),
      });

      // the edit of b.ts on 03-04 is a revision; the rename of b.ts to c.ts on
      // 03-05 is a commit of the window that adds none; the edit of c.ts on
      // 03-06 is outside the window
      assert.strictEqual(result.files.get("c.ts")?.revisions, 1);
      assert.strictEqual(result.commits.length, 2);
    }),
  );
});

layer(NodeServices.layer)("readHistory skipped commits", (it) => {
  it.effect("ignores the changes of the commits it is told to skip", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "a\nb\n" });
      const first = (yield* repo.git("rev-parse", "HEAD~1")).trim();

      const result = yield* history(repo, {
        universe: new Set(["a.ts"]),
        skipCommits: new Set([first]),
      });

      assert.strictEqual(result.files.get("a.ts")?.revisions, 1);
      assert.strictEqual(result.commits.length, 1);
    }),
  );
});

layer(NodeServices.layer)("readHistory content", (it) => {
  it.effect("counts binary files as changes of zero lines", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "blob.ts": new Uint8Array([97, 0, 98, 0]),
      });

      const result = yield* history(repo, { universe: new Set(["blob.ts"]) });

      assert.deepStrictEqual(result.files.get("blob.ts"), {
        revisions: 1,
        linesAdded: 0,
        linesDeleted: 0,
      });
    }),
  );
});

layer(NodeServices.layer)("readHistoryHalves", (it) => {
  it.effect(
    "splits commits at the time and follows a rename across the split",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitRenamedTwice(repo);

        const { recent, earlier } = yield* readHistoryHalves(
          {
            since: "2026-01-01T00:00:00.000Z",
            until: "2026-12-31T00:00:00.000Z",
            skipCommits: new Set(),
            universe: new Set(["c.ts", "other.ts"]),
          },
          // the commit at exactly this time belongs to the recent half
          Date.parse("2026-03-04T12:00:00Z") / 1000,
        ).pipe(Effect.provide(Git.layer(repo.directory)));

        // recent: the edit and the last edit; earlier: creation and edit; the renames add none
        assert.deepStrictEqual(recent.files.get("c.ts"), {
          revisions: 2,
          linesAdded: 2,
          linesDeleted: 0,
        });
        assert.deepStrictEqual(earlier.files.get("c.ts"), {
          revisions: 2,
          linesAdded: 11,
          linesDeleted: 0,
        });
        assert.isFalse(recent.files.has("other.ts"));
        assert.strictEqual(earlier.files.get("other.ts")?.revisions, 1);
        assert.deepStrictEqual(pathsOfCommits(recent), [
          ["c.ts"],
          ["c.ts"],
          ["c.ts"],
        ]);
      }),
  );
});
