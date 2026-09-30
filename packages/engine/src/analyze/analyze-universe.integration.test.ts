import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));
const DATE = "2026-05-01T12:00:00Z";

layer(NodeServices.layer)("analyze universe", (it) => {
  it.effect(
    "excludes ignored, linguist-generated, linguist-vendored, binary, and minified files",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          "kept.ts": "a\n",
          "ignored.ts": "a\n",
          "generated.ts": "a\n",
          "vendored.ts": "a\n",
          "binary.ts": new Uint8Array([97, 0, 98]),
          "minified.ts": "a".repeat(400),
        });
        yield* repo.commit(DATE, {
          ".gitignore": "ignored.ts\n",
          ".gitattributes":
            "generated.ts linguist-generated\nvendored.ts linguist-vendored\n",
        });

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.files.map((file) => file.path),
          ["kept.ts"],
        );
      }),
  );

  it.effect(
    "replaces the language allow-list with include globs and then applies exclude globs",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(DATE, {
          "src/app.ts": "a\n",
          "docs/guide.md": "# guide\n",
          "docs/draft.md": "# draft\n",
          "README.md": "# readme\n",
        });

        const report = yield* analyze(
          analyzeOptionsFor(repo, {
            include: ["**/*.md"],
            exclude: ["docs/draft.md"],
          }),
        );

        assert.deepStrictEqual(
          report.files.map((file) => file.path),
          ["README.md", "docs/guide.md"],
        );
      }),
  );
});
