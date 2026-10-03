import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

/** Ten distinct lines at one indentation. */
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

layer(NodeServices.layer)("readHistory mechanical whitespace", (it) => {
  it.effect("leaves out a commit that only reindents", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("  ") });
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": body("    ") });
      yield* repo.commit("2026-03-03T12:00:00Z", {
        "a.ts": `${body("    ")}const more = 1;\n`,
      });

      const result = yield* history(repo, ["a.ts"]);

      assert.deepStrictEqual(
        result.commits.map(({ mechanical }) => mechanical),
        [undefined, "whitespace", undefined],
      );
      assert.deepStrictEqual(result.files.get("a.ts"), {
        revisions: 2,
        changes: 2,
        linesAdded: 11,
        linesDeleted: 0,
      });
    }),
  );

  it.effect("counts a commit that reindents and changes a line", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body("  ") });
      yield* repo.commit("2026-03-02T12:00:00Z", {
        "a.ts": body("    ").replace("value3 = 3", "value3 = 33"),
      });

      const result = yield* history(repo, ["a.ts"]);

      assert.strictEqual(result.mechanical.whitespace, 0);
      assert.strictEqual(result.files.get("a.ts")?.revisions, 2);
    }),
  );
});

layer(NodeServices.layer)(
  "readHistory whitespace in indentation-significant files",
  (it) => {
    it.effect(
      "counts a commit that moves a statement out of a Python block",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "p.py": "if ready:\n    a()\n    b()\n",
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "p.py": "if ready:\n    a()\nb()\n",
          });

          const result = yield* history(repo, ["p.py"]);

          assert.strictEqual(result.mechanical.whitespace, 0);
          assert.strictEqual(result.files.get("p.py")?.revisions, 2);
        }),
    );

    it.effect(
      "counts a re-indent in a commit that also changes a YAML file",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": body("  "),
            "ci.yml": "jobs:\n  build:\n    run: x\n",
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": body("    "),
            "ci.yml": "jobs:\n  build:\n  run: x\n",
          });

          const result = yield* history(repo, ["a.ts"]);

          assert.strictEqual(result.mechanical.whitespace, 0);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 2);
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory whitespace in Scala 3 and Make files",
  (it) => {
    it.effect(
      "counts a commit that moves a statement out of a Scala 3 block",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "App.scala": "def run() =\n  a()\n  b()\n",
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "App.scala": "def run() =\n  a()\nb()\n",
          });

          const result = yield* history(repo, ["App.scala"]);

          assert.strictEqual(result.mechanical.whitespace, 0);
          assert.strictEqual(result.files.get("App.scala")?.revisions, 2);
        }),
    );

    it.effect("counts a Makefile.am that changes a tab into spaces", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "Makefile.am": "all:\n\tcc main.c\n",
        });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "Makefile.am": "all:\n    cc main.c\n",
        });

        const result = yield* history(repo, ["Makefile.am"]);

        assert.strictEqual(result.mechanical.whitespace, 0);
        assert.strictEqual(result.files.get("Makefile.am")?.revisions, 2);
      }),
    );
  },
);
