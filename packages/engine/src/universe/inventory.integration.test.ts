import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { inventory } from "./inventory.js";
import type { InventoryOptions } from "./inventory.js";

const DATE = "2026-03-01T12:00:00Z";

const pathsOf = (
  repo: TempRepository,
  options: Partial<InventoryOptions> = {},
) =>
  inventory({
    root: repo.directory,
    scope: ".",
    include: [],
    exclude: [],
    ...options,
  }).pipe(
    Effect.provide(Git.layer(repo.directory)),
    Effect.map((files) => files.map((file) => file.path)),
  );

layer(NodeServices.layer)("inventory git rules", (it) => {
  it.effect(
    "keeps tracked files of the language allow-list, sorted by path",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          "src/b.ts": "b\n",
          "src/a.py": "a\n",
          "README.md": "# readme\n",
          "notes.txt": "notes\n",
        });

        assert.deepStrictEqual(yield* pathsOf(repo), ["src/a.py", "src/b.ts"]);
      }),
  );

  it.effect("drops tracked files that ignore rules match", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit(DATE, { "kept.ts": "a\n", "ignored.ts": "a\n" });
      yield* repo.commit(DATE, { ".gitignore": "ignored.ts\n" });

      assert.deepStrictEqual(yield* pathsOf(repo), ["kept.ts"]);
    }),
  );

  it.effect("drops files marked linguist-generated or linguist-vendored", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit(DATE, {
        "a-generated.ts": "a\n",
        "b-vendored.ts": "a\n",
        "c-not-generated.ts": "a\n",
        "d-plain.ts": "a\n",
        ".gitattributes": [
          "a-generated.ts linguist-generated",
          "b-vendored.ts linguist-vendored=true",
          "c-not-generated.ts linguist-generated=false",
        ].join("\n"),
      });

      assert.deepStrictEqual(yield* pathsOf(repo), [
        "c-not-generated.ts",
        "d-plain.ts",
      ]);
    }),
  );
});

layer(NodeServices.layer)("inventory name rules", (it) => {
  it.effect(
    "drops vendored, dependency, build output, and generated directories and minified names",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          "src/app.ts": "a\n",
          "vendor/lib.js": "a\n",
          "web/node_modules/pkg/index.js": "a\n",
          "dist/out.js": "a\n",
          "packages/x/build/out.js": "a\n",
          "packages/contracts/generated/spec.js": "a\n",
          "src/__generated__/schema.ts": "a\n",
          "src/app.min.js": "a\n",
          "src/build.ts": "a\n",
        });

        assert.deepStrictEqual(yield* pathsOf(repo), [
          "src/app.ts",
          "src/build.ts",
        ]);
      }),
  );
});

layer(NodeServices.layer)("inventory globs", (it) => {
  it.effect("replaces the allow-list with include globs", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit(DATE, {
        "src/app.ts": "a\n",
        "docs/guide.md": "# guide\n",
        "README.md": "# readme\n",
      });

      const paths = yield* pathsOf(repo, { include: ["**/*.md"] });

      assert.deepStrictEqual(paths, ["README.md", "docs/guide.md"]);
    }),
  );

  it.effect(
    "removes exclude globs after include, matching dot paths and exact paths",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          "src/a.ts": "a\n",
          "src/gen/b.ts": "a\n",
          ".config/c.ts": "a\n",
          "src/[id].ts": "a\n",
        });

        const paths = yield* pathsOf(repo, {
          exclude: ["src/gen/**", ".config/**", "src/[id].ts"],
        });

        assert.deepStrictEqual(paths, ["src/a.ts"]);
      }),
  );

  it.effect("limits the universe to the scope", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit(DATE, { "src/a.ts": "a\n", "lib/b.ts": "a\n" });

      assert.deepStrictEqual(yield* pathsOf(repo, { scope: "src" }), [
        "src/a.ts",
      ]);
    }),
  );
});

layer(NodeServices.layer)("inventory content rules", (it) => {
  it.effect("drops files with a NUL byte in their first 8 KiB", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit(DATE, {
        "blob.ts": new Uint8Array([97, 0, 98]),
        "late-nul.ts": `${"a\n".repeat(5000)}\0`,
        "text.ts": "a\n",
      });

      assert.deepStrictEqual(yield* pathsOf(repo), ["late-nul.ts", "text.ts"]);
    }),
  );

  it.effect("drops files larger than 1 MiB", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit(DATE, {
        "exactly-1mib.ts": "a\n".repeat(524_288),
        "over-1mib.ts": "a\n".repeat(524_289),
      });

      assert.deepStrictEqual(yield* pathsOf(repo), ["exactly-1mib.ts"]);
    }),
  );

  it.effect(
    "drops minified files whose lines average over 300 characters",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          "bundle.ts": "a".repeat(400),
          "normal.ts": "a".repeat(100),
        });

        assert.deepStrictEqual(yield* pathsOf(repo), ["normal.ts"]);
      }),
  );
});

layer(NodeServices.layer)("inventory measures", (it) => {
  it.effect("reports the indentation complexity of each file", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit(DATE, { "a.ts": "a\n  b\n", "empty.ts": "" });

      const files = yield* inventory({
        root: repo.directory,
        scope: ".",
        include: [],
        exclude: [],
      }).pipe(Effect.provide(Git.layer(repo.directory)));

      assert.deepStrictEqual(files, [
        { path: "a.ts", complexity: { loc: 2, total: 1, mean: 0.5, max: 1 } },
        { path: "empty.ts", complexity: { loc: 0, total: 0, mean: 0, max: 0 } },
      ]);
    }),
  );
});
