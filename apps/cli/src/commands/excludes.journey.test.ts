import { Analysis, InspectResult } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { makeGitRepository } from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";

/** `src/a.ts`, its test, and a generated client, changing together three times. */
const makeTestedProject = Effect.map(makeGitRepository, (repo) => {
  for (const day of [20, 10, 5]) {
    repo.commit(day, {
      "src/a.ts": `run(${day});\n`,
      "src/a.test.ts": `test(${day});\n`,
      "src/client.gen.ts": `call(${day});\n`,
    });
  }
  return repo;
});

const analyzeJson = (cwd: string, flags: ReadonlyArray<string>) =>
  Effect.flatMap(
    journey({ args: ["analyze", "--json", ...flags], cwd }),
    ({ stdout }) => Schema.decodeUnknownEffect(Analysis)(JSON.parse(stdout)),
  );

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat analyze --no-default-excludes", () => {
  it.live(
    "analyzes what the default patterns leave out, and leaves out only what --exclude names",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTestedProject;

        const withDefaults = yield* analyzeJson(repo.root, [
          "--exclude",
          "src/a.ts",
        ]);
        const withoutDefaults = yield* analyzeJson(repo.root, [
          "--no-default-excludes",
          "--exclude",
          "src/client.gen.ts",
        ]);

        expect(withDefaults.files).toStrictEqual([]);
        expect(
          withDefaults.excludes
            .filter(({ files }) => files > 0)
            .map(({ pattern, source, files }) => [pattern, source, files]),
        ).toStrictEqual([
          ["**/*.test.*", "default", 1],
          ["**/*.gen.*", "default", 1],
          ["src/a.ts", "user", 1],
        ]);
        expect(
          withoutDefaults.files.map(({ path }) => path).toSorted(),
        ).toStrictEqual(["src/a.test.ts", "src/a.ts"]);
        expect(withoutDefaults.excludes).toStrictEqual([
          { pattern: "src/client.gen.ts", source: "user", files: 1 },
        ]);
      }).pipe(Effect.scoped),
  );
});

describe("codeheat inspect --no-default-excludes", () => {
  it.live("inspects a test file the default patterns would leave out", () =>
    Effect.gen(function* () {
      const repo = yield* makeTestedProject;

      const result = yield* journey({
        args: ["inspect", "src/a.test.ts", "--no-default-excludes", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(result.stdout),
      );
      expect(inspected.matches.map(({ path }) => path)).toStrictEqual([
        "src/a.test.ts",
      ]);
      expect(inspected.excluded).toStrictEqual([]);
    }).pipe(Effect.scoped),
  );
});
