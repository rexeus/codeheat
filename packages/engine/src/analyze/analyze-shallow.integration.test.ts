import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

layer(NodeServices.layer)("analyze a shallow clone", (it) => {
  it.effect(
    "does not count the boundary commit, which git shows as adding the whole tree",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-05-01T12:00:00Z", {
          "a.ts": "1\n",
          "b.ts": "1\n",
        });
        yield* repo.commit("2026-05-02T12:00:00Z", { "a.ts": "2\n" });
        yield* repo.commit("2026-05-03T12:00:00Z", { "a.ts": "3\n" });
        const clone = `${yield* fs.makeTempDirectoryScoped()}/clone`;
        yield* repo.git(
          "clone",
          "--quiet",
          "--depth",
          "2",
          `file://${repo.directory}`,
          clone,
        );

        const complete = yield* analyze(analyzeOptionsFor(repo));
        const shallow = yield* analyze(analyzeOptionsFor({ directory: clone }));

        // the clone holds the commits of 05-02 and 05-03; the older one is its boundary
        assert.strictEqual(complete.repository.shallow, false);
        assert.strictEqual(shallow.repository.shallow, true);
        assert.deepStrictEqual(
          shallow.files.map((file) => [file.path, file.revisions]),
          [
            ["a.ts", 1],
            ["b.ts", 0],
          ],
        );
        assert.strictEqual(shallow.window.commits, 1);
      }),
  );
});
