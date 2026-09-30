import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Path } from "effect";
import { TestClock } from "effect/testing";

import { analyze } from "../analyze/analyze.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { inspectFrom } from "./inspect-from.js";

const DATE = "2026-05-01T12:00:00Z";

/**
 * `index.ts` exists at the root and in `pkg/`, where it is generated and so
 * outside the universe; `src/a.ts` only at the root.
 */
const makeProject = Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));
  const repo = yield* makeTempRepository;
  yield* repo.commit(DATE, {
    "index.ts": "a\n",
    "src/a.ts": "a\n",
    "pkg/index.ts": "a\n",
    "pkg/lib.ts": "a\n",
    ".gitattributes": "pkg/index.ts linguist-generated\n",
  });
  const path = yield* Path.Path;
  const report = yield* analyze(analyzeOptionsFor(repo));
  return {
    directory: repo.directory,
    inspectIn: (subdirectory: string, patterns: ReadonlyArray<string>) =>
      inspectFrom({
        cwd: path.join(repo.directory, subdirectory),
        report,
        patterns,
      }).pipe(
        Effect.map((result) => ({
          matched: result.matches.map((entry) => entry.path),
          unmatched: result.unmatched,
        })),
      ),
  };
});

layer(NodeServices.layer)("inspectFrom exact paths", (it) => {
  it.effect("resolves a path relative to the working directory", () =>
    Effect.gen(function* () {
      const project = yield* makeProject;

      const result = yield* project.inspectIn("pkg", ["lib.ts"]);

      assert.deepStrictEqual(result, {
        matched: ["pkg/lib.ts"],
        unmatched: [],
      });
    }),
  );

  it.effect("resolves a path that climbs out of the working directory", () =>
    Effect.gen(function* () {
      const project = yield* makeProject;

      const result = yield* project.inspectIn("pkg", ["../src/a.ts"]);

      assert.deepStrictEqual(result, { matched: ["src/a.ts"], unmatched: [] });
    }),
  );

  it.effect("resolves an absolute path", () =>
    Effect.gen(function* () {
      const project = yield* makeProject;
      const absolute = `${project.directory}/src/a.ts`;

      const result = yield* project.inspectIn("pkg", [absolute]);

      assert.deepStrictEqual(result, { matched: ["src/a.ts"], unmatched: [] });
    }),
  );

  it.effect(
    "reads an unanchored path as repository-relative when nothing exists at that place",
    () =>
      Effect.gen(function* () {
        const project = yield* makeProject;

        const result = yield* project.inspectIn("src", ["src/a.ts"]);

        assert.deepStrictEqual(result, {
          matched: ["src/a.ts"],
          unmatched: [],
        });
      }),
  );
});

layer(NodeServices.layer)("inspectFrom unmatched paths", (it) => {
  it.effect(
    "does not answer with another file when the path exists but is outside the universe",
    () =>
      Effect.gen(function* () {
        const project = yield* makeProject;

        const result = yield* project.inspectIn("pkg", ["index.ts"]);

        assert.deepStrictEqual(result, {
          matched: [],
          unmatched: ["index.ts"],
        });
      }),
  );

  it.effect(
    "does not read a path starting with ./ as repository-relative",
    () =>
      Effect.gen(function* () {
        const project = yield* makeProject;

        const result = yield* project.inspectIn("pkg", [
          "./src/a.ts",
          "./lib.ts",
        ]);

        assert.deepStrictEqual(result, {
          matched: ["pkg/lib.ts"],
          unmatched: ["./src/a.ts"],
        });
      }),
  );

  it.effect(
    "reports patterns as requested, including a path outside the repository",
    () =>
      Effect.gen(function* () {
        const project = yield* makeProject;
        const outside = "/nonexistent/codeheat/a.ts";

        const result = yield* project.inspectIn("pkg", [
          outside,
          "missing.ts",
          "gone/*.ts",
        ]);

        assert.deepStrictEqual(result, {
          matched: [],
          unmatched: [outside, "missing.ts", "gone/*.ts"],
        });
      }),
  );

  it.effect("keeps a glob repository-relative from a subdirectory", () =>
    Effect.gen(function* () {
      const project = yield* makeProject;

      const result = yield* project.inspectIn("pkg", ["src/*.ts"]);

      assert.deepStrictEqual(result, { matched: ["src/a.ts"], unmatched: [] });
    }),
  );
});
