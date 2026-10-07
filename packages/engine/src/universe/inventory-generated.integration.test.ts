import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { inventory } from "./inventory.js";

const DATE = "2026-03-01T12:00:00Z";

const generatedIn = (directory: string) =>
  inventory({ root: directory, scope: ".", include: [], exclude: [] }).pipe(
    Effect.provide(Git.layer(directory)),
    Effect.map(({ generated }) => generated),
  );

layer(NodeServices.layer)("inventory generated files", (it) => {
  it.effect(
    "counts the files named like code that it leaves out as generated",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          ".gitattributes": "src/schema.ts linguist-generated\n",
          "src/a.ts": "a\n",
          "src/schema.ts": "s\n",
          "dist/a.js": "a\n",
          "src/lib.min.js": "m\n",
          "src/skipped.ts": "x\n",
          "README.md": "# readme\n",
        });

        const { files, generated } = yield* inventory({
          root: repo.directory,
          scope: ".",
          include: [],
          exclude: ["src/skipped.ts"],
        }).pipe(Effect.provide(Git.layer(repo.directory)));

        assert.deepStrictEqual(
          { files: files.map(({ path }) => path), generated },
          { files: ["src/a.ts"], generated: 3 },
        );
      }),
  );

  it.effect(
    "counts binary and minified content, not a missing or blank file",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          "src/binary.ts": new Uint8Array([97, 0, 98]),
          "src/bundle.js": `${"x".repeat(400)}\n`,
          "src/blank.ts": "  \n\n",
          "src/gone.ts": "g\n",
        });
        yield* fs.remove(path.join(repo.directory, "src/gone.ts"));

        assert.strictEqual(yield* generatedIn(repo.directory), 2);
      }),
  );
});
