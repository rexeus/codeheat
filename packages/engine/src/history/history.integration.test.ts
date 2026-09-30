import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";
import type { HistoryOptions } from "./history.js";

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

        // creation, three edits, and two renames touch the one file
        assert.deepStrictEqual(result.files.get("c.ts"), {
          revisions: 6,
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

      assert.deepStrictEqual(
        result.commits.map((paths) => paths.toSorted()),
        [
          ["c.ts"],
          ["c.ts"],
          ["c.ts"],
          ["c.ts"],
          ["c.ts"],
          ["c.ts", "other.ts"],
        ],
      );
    }),
  );
});

layer(NodeServices.layer)("readHistory universe and window", (it) => {
  it.effect("drops paths outside the universe", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitRenamedTwice(repo);

      const result = yield* history(repo, { universe: new Set(["other.ts"]) });

      assert.deepStrictEqual([...result.files.keys()], ["other.ts"]);
      assert.deepStrictEqual(result.commits, [["other.ts"]]);
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

      // the edit of b.ts on 03-04 and the rename of b.ts to c.ts on 03-05;
      // the rename is in the window but the edit of c.ts on 03-06 is not
      assert.strictEqual(result.files.get("c.ts")?.revisions, 2);
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
