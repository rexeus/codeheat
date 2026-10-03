import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { readHistory, readHistoryHalves } from "../testing/history.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import type { HistoryOptions } from "./history.js";

/** Ten distinct lines, so git sees a moved file as the same file. */
const body = (indent: string) =>
  Array.from(
    { length: 10 },
    (_, index) => `${indent}const value${index} = ${index};\n`,
  ).join("");

const options = (
  universe: ReadonlyArray<string>,
  window: Partial<Pick<HistoryOptions, "since" | "until">> = {},
): HistoryOptions => ({
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-12-31T00:00:00.000Z",
  skipCommits: new Set(),
  universe: new Set(universe),
  ...window,
});

const history = (
  repo: TempRepository,
  universe: ReadonlyArray<string>,
  window: Partial<Pick<HistoryOptions, "since" | "until">> = {},
) =>
  readHistory(options(universe, window)).pipe(
    Effect.provide(Git.layer(repo.directory)),
  );

layer(NodeServices.layer)("readHistory mechanical renames", (it) => {
  it.effect(
    "leaves exact renames and mode changes out of the revisions but keeps them as commits",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.git("config", "core.fileMode", "false");
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
        yield* repo.git("mv", "a.ts", "b.ts");
        yield* repo.commit("2026-03-02T12:00:00Z");
        yield* repo.git("update-index", "--chmod=+x", "b.ts");
        yield* repo.commit("2026-03-03T12:00:00Z");

        const result = yield* history(repo, ["b.ts"]);

        assert.deepStrictEqual(result.mechanical, {
          ignored: 0,
          renames: 2,
          whitespace: 0,
          reverts: 0,
          duplicates: 0,
        });
        assert.deepStrictEqual(
          result.commits.map(({ mechanical }) => mechanical),
          ["renames", "renames", undefined],
        );
        assert.strictEqual(result.files.get("b.ts")?.revisions, 1);
      }),
  );

  it.effect(
    "counts a commit that renames one file exactly and edits another",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "a.ts": body(""),
          "other.ts": "one\n",
        });
        yield* repo.git("mv", "a.ts", "b.ts");
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "other.ts": "one\ntwo\n",
        });

        const result = yield* history(repo, ["b.ts", "other.ts"]);

        assert.strictEqual(result.mechanical.renames, 0);
        assert.strictEqual(result.files.get("b.ts")?.revisions, 2);
        assert.strictEqual(result.files.get("other.ts")?.revisions, 2);
      }),
  );
});

layer(NodeServices.layer)(
  "readHistory renames that are not mechanical",
  (it) => {
    it.effect(
      "counts a rename that also edits the file, which is no longer an exact rename",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
          yield* repo.git("mv", "a.ts", "b.ts");
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "b.ts": `${body("")}const more = 1;\n`,
          });

          const result = yield* history(repo, ["b.ts"]);

          assert.strictEqual(result.mechanical.renames, 0);
          assert.strictEqual(result.files.get("b.ts")?.revisions, 2);
        }),
    );

    it.effect(
      "still follows a file across an exact rename, which carries its earlier history",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": `${body("")}// edit\n`,
          });
          yield* repo.git("mv", "a.ts", "b.ts");
          yield* repo.commit("2026-03-03T12:00:00Z");
          yield* repo.commit("2026-03-04T12:00:00Z", {
            "b.ts": `${body("")}// edit\n// again\n`,
          });

          const result = yield* history(repo, ["b.ts"]);

          // creation and two edits, under the name the file has today
          assert.deepStrictEqual(result.files.get("b.ts"), {
            revisions: 3,
            changes: 3,
            linesAdded: 12,
            linesDeleted: 0,
          });
          assert.strictEqual(result.mechanical.renames, 1);
        }),
    );
  },
);

layer(NodeServices.layer)("readHistory mechanical reverts", (it) => {
  it.effect(
    "leaves out a revert and the commit it reverts when both are in the window",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "a.ts": `${body("")}const risky = 1;\n`,
        });
        yield* repo.gitAt(
          "2026-03-03T12:00:00Z",
          "revert",
          "--no-edit",
          "HEAD",
        );
        yield* repo.commit("2026-03-04T12:00:00Z", {
          "a.ts": `${body("")}const kept = 1;\n`,
        });

        const result = yield* history(repo, ["a.ts"]);

        assert.strictEqual(result.mechanical.reverts, 2);
        assert.deepStrictEqual(
          result.commits.map(({ mechanical }) => mechanical),
          [undefined, "reverts", "reverts", undefined],
        );
        assert.strictEqual(result.files.get("a.ts")?.revisions, 2);
      }),
  );

  it.effect("counts a revert whose original lies before the window", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
      yield* repo.commit("2026-03-02T12:00:00Z", {
        "a.ts": `${body("")}const risky = 1;\n`,
      });
      yield* repo.gitAt("2026-03-10T12:00:00Z", "revert", "--no-edit", "HEAD");

      const result = yield* history(repo, ["a.ts"], {
        since: "2026-03-05T00:00:00.000Z",
      });

      assert.strictEqual(result.mechanical.reverts, 0);
      assert.deepStrictEqual(result.files.get("a.ts"), {
        revisions: 1,
        changes: 1,
        linesAdded: 0,
        linesDeleted: 1,
      });
    }),
  );
});

layer(NodeServices.layer)("readHistory reverts across a window", (it) => {
  it.effect("counts the original of a revert that lies after the window", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
      yield* repo.commit("2026-03-02T12:00:00Z", {
        "a.ts": `${body("")}const risky = 1;\n`,
      });
      yield* repo.gitAt("2026-03-10T12:00:00Z", "revert", "--no-edit", "HEAD");

      const result = yield* history(repo, ["a.ts"], {
        until: "2026-03-05T00:00:00.000Z",
      });

      assert.strictEqual(result.mechanical.reverts, 0);
      assert.strictEqual(result.files.get("a.ts")?.revisions, 2);
    }),
  );

  it.effect("pairs a revert with its original only inside one half", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
      yield* repo.commit("2026-03-02T12:00:00Z", {
        "a.ts": `${body("")}const risky = 1;\n`,
      });
      yield* repo.gitAt("2026-03-10T12:00:00Z", "revert", "--no-edit", "HEAD");

      const { recent, earlier } = yield* readHistoryHalves(
        options(["a.ts"]),
        Date.parse("2026-03-05T00:00:00Z") / 1000,
      ).pipe(Effect.provide(Git.layer(repo.directory)));

      assert.strictEqual(recent.mechanical.reverts, 0);
      assert.strictEqual(earlier.mechanical.reverts, 0);
      assert.strictEqual(recent.files.get("a.ts")?.revisions, 1);
      assert.strictEqual(earlier.files.get("a.ts")?.revisions, 2);
    }),
  );
});

layer(NodeServices.layer)("readHistory ignored revisions", (it) => {
  it.effect("leaves out the commits .git-blame-ignore-revs lists at HEAD", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
      const first = (yield* repo.git("rev-parse", "HEAD")).trim();
      yield* repo.commit("2026-03-02T12:00:00Z", {
        "a.ts": `${body("")}const sweep = 1;\n`,
      });
      const sweep = (yield* repo.git("rev-parse", "HEAD")).trim();
      yield* repo.commit("2026-03-03T12:00:00Z", {
        "a.ts": `${body("")}const sweep = 1;\nconst real = 1;\n`,
        ".git-blame-ignore-revs": `# a sweep\n${sweep} # trailing comment\n\nnot-a-revision\n${first.slice(0, 12)}\n`,
      });

      const result = yield* history(repo, ["a.ts"]);

      assert.deepStrictEqual(
        result.commits.map(({ mechanical }) => mechanical),
        [undefined, "ignored", undefined],
      );
      assert.strictEqual(result.mechanical.ignored, 1);
      assert.strictEqual(result.files.get("a.ts")?.revisions, 2);
    }),
  );

  it.effect("reads a list with Windows line endings and inline comments", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });
      yield* repo.commit("2026-03-02T12:00:00Z", {
        "a.ts": `${body("")}const sweep = 1;\n`,
      });
      const sweep = (yield* repo.git("rev-parse", "HEAD")).trim();
      yield* repo.commit("2026-03-03T12:00:00Z", {
        ".git-blame-ignore-revs": `# a sweep\r\n${sweep} # prettier\r\n`,
      });

      const result = yield* history(repo, ["a.ts"]);

      assert.strictEqual(result.mechanical.ignored, 1);
    }),
  );

  it.effect("ignores nothing without a list", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("") });

      const result = yield* history(repo, ["a.ts"]);

      assert.strictEqual(result.mechanical.ignored, 0);
    }),
  );
});
