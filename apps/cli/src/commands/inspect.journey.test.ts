import { InspectResult } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeCoupledProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat inspect against a git repository", () => {
  it.live("returns several entries when inspect is given a glob", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", "src/*.ts", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(result.stdout),
      );
      expect(inspected.matches.map(({ path, of }) => [path, of])).toStrictEqual(
        [
          ["src/a.ts", 3],
          ["src/b.ts", 3],
          ["src/c.ts", 3],
        ],
      );
      expect(inspected.matches[0]?.partners).toMatchObject([
        { path: "src/b.ts", probability: 1 },
      ]);
      expect(inspected.matches[0]?.module).toBe("src");
      expect(inspected.modules).toMatchObject([
        { path: "src", commits: 4, cohesion: 1 },
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("inspects the whole repository from a subdirectory", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", "src/a.ts", "--json"],
        cwd: `${repo.root}/src`,
      });

      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(result.stdout),
      );
      expect(inspected.matches.map(({ path, of }) => [path, of])).toStrictEqual(
        [["src/a.ts", 3]],
      );
    }).pipe(Effect.scoped),
  );
});

const inspectedPaths = (stdout: string) =>
  Schema.decodeUnknownEffect(InspectResult)(JSON.parse(stdout)).pipe(
    Effect.map(({ matches }) => matches.map(({ path }) => path)),
  );

// How paths resolve is the engine's concern (inspect-from.integration.test.ts);
// these journeys prove the CLI hands over its working directory and the spelling.
describe("codeheat inspect with exact paths", () => {
  it.live("resolves a path relative to the working directory", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", "b.ts", "--json"],
        cwd: `${repo.root}/src`,
      });

      expect(result.exitCode).toBe(0);
      expect(yield* inspectedPaths(result.stdout)).toStrictEqual(["src/b.ts"]);
    }).pipe(Effect.scoped),
  );

  it.live("names an unmatched path as it was typed", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", "./a.ts", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(4);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain('"./a.ts"');
    }).pipe(Effect.scoped),
  );
});

describe("codeheat inspect --entry", () => {
  it.live(
    "names the interface of the matched modules the interface of the matched modules",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCoupledProject;

        const result = yield* journey({
          args: ["inspect", "src/b.ts", "--entry", "src/c.ts", "--json"],
          cwd: repo.root,
        });

        const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
          JSON.parse(result.stdout),
        );
        // c.ts changes only in the first of the 4 commits, which also changes a.ts and b.ts
        expect(inspected.modules).toMatchObject([
          {
            entryPoints: ["src/c.ts"],
            interfaceCommits: 1,
            implementationCommits: 4,
            leakage: 0.25,
          },
        ]);
      }).pipe(Effect.scoped),
  );
});
