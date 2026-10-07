import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { inventory } from "./inventory.js";

const DATE = "2026-03-01T12:00:00Z";

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
});
