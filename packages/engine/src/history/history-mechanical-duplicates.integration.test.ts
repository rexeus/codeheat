import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

/** Ten distinct lines. */
const body = (indent: string) =>
  Array.from(
    { length: 10 },
    (_, index) => `${indent}const value${index} = ${index};\n`,
  ).join("");

const history = (repo: TempRepository, universe: ReadonlyArray<string>) =>
  readHistory({
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-12-31T00:00:00.000Z",
    skipCommits: new Set(),
    universe: new Set(universe),
  }).pipe(Effect.provide(Git.layer(repo.directory)));

layer(NodeServices.layer)("readHistory duplicate patches", (it) => {
  it.effect("keeps patches that differ in content or in path", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      const before = body("");
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "a.ts": before,
        "b.ts": before,
      });
      yield* repo.commit("2026-03-02T12:00:00Z", {
        "a.ts": before.replace("value3 = 3", "value3 = 33"),
      });
      yield* repo.commit("2026-03-03T12:00:00Z", {
        "b.ts": before.replace("value3 = 3", "value3 = 33"),
      });
      yield* repo.commit("2026-03-04T12:00:00Z", {
        "a.ts": before.replace("value3 = 3", "value3 = 34"),
      });

      const result = yield* history(repo, ["a.ts", "b.ts"]);

      assert.strictEqual(result.mechanical.duplicates, 0);
    }),
  );
});

layer(NodeServices.layer)(
  "readHistory copies and re-lands of a patch",
  (it) => {
    it.effect("counts a patch that lands again after it was backed out", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const before = body("");
        const after = before.replace("value3 = 3", "value3 = 33");
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": before });
        yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": after });
        yield* repo.commit("2026-03-03T12:00:00Z", { "a.ts": before });
        yield* repo.commit("2026-03-04T12:00:00Z", { "a.ts": after });

        const result = yield* history(repo, ["a.ts"]);

        // the last commit is the same patch as the second, applied on top of it
        assert.strictEqual(result.mechanical.duplicates, 0);
        assert.strictEqual(result.files.get("a.ts")?.revisions, 4);
      }),
    );

    it.effect(
      "leaves out a cherry-pick on a parallel branch that is merged later",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          const before = body("");
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": before });
          const base = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": before.replace("value3 = 3", "value3 = 33"),
          });
          const change = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.git("checkout", "--quiet", "-b", "backport", base);
          yield* repo.gitAt("2026-03-03T12:00:00Z", "cherry-pick", change);
          yield* repo.git("checkout", "--quiet", "-");
          yield* repo.gitAt(
            "2026-03-04T12:00:00Z",
            "merge",
            "--no-edit",
            "backport",
          );

          const result = yield* history(repo, ["a.ts"]);

          assert.deepStrictEqual(
            result.commits.map(({ mechanical }) => mechanical),
            ["duplicates", undefined, undefined],
          );
          assert.strictEqual(result.files.get("a.ts")?.revisions, 2);
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory re-lands of a patch with several copies",
  (it) => {
    it.effect(
      "counts a re-land on top of a later copy when an older copy lies on a parallel line",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          const before = body("");
          const after = before.replace("value3 = 3", "value3 = 33");
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": before });
          yield* repo.git("checkout", "--quiet", "-b", "side");
          yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": after });
          yield* repo.git("checkout", "--quiet", "-");
          yield* repo.commit("2026-03-03T12:00:00Z", { "a.ts": after });
          yield* repo.commit("2026-03-04T12:00:00Z", { "a.ts": before });
          yield* repo.commit("2026-03-05T12:00:00Z", { "a.ts": after });
          yield* repo.gitAt(
            "2026-03-06T12:00:00Z",
            "merge",
            "--no-edit",
            "side",
          );

          const result = yield* history(repo, ["a.ts"]);

          // newest first: the re-land, the back-out, a copy of the side commit, the side commit, the base
          assert.deepStrictEqual(
            result.commits.map(({ mechanical }) => mechanical),
            [undefined, undefined, "duplicates", undefined, undefined],
          );
          assert.strictEqual(result.files.get("a.ts")?.revisions, 4);
        }),
    );
  },
);
