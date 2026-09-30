import { InspectResult } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  makeGitRepository,
  makeTempDirectory,
} from "../testing/git-repository.js";
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

  it.live("resolves an absolute path to its repository-relative path", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", `${repo.root}/src/c.ts`, "--json"],
        cwd: `${repo.root}/src`,
      });

      expect(result.exitCode).toBe(0);
      expect(yield* inspectedPaths(result.stdout)).toStrictEqual(["src/c.ts"]);
    }).pipe(Effect.scoped),
  );

  it.live("keeps a glob repository-relative from a subdirectory", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", "src/*.ts", "--json"],
        cwd: `${repo.root}/src`,
      });

      expect(yield* inspectedPaths(result.stdout)).toStrictEqual([
        "src/a.ts",
        "src/b.ts",
        "src/c.ts",
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("reports a path outside the repository as unmatched", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;
      const elsewhere = yield* makeTempDirectory;
      const outside = `${elsewhere}/a.ts`;

      const result = yield* journey({
        args: ["inspect", outside, "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(4);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(outside);
    }).pipe(Effect.scoped),
  );
});

// `index.ts` exists at the root and in `pkg/`, where it is generated and so outside the universe.
const makeShadowedProject = Effect.map(makeGitRepository, (repo) => {
  repo.commit(5, {
    "index.ts": "run();\n",
    "src/b.ts": "run();\n",
    "pkg/index.ts": "run();\n",
    "pkg/lib.ts": "run();\n",
    ".gitattributes": "pkg/index.ts linguist-generated\n",
  });
  return repo;
});

describe("codeheat inspect when a path could name two files", () => {
  it.live(
    "does not answer with the root file for a generated file in the working directory",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeShadowedProject;

        const result = yield* journey({
          args: ["inspect", "index.ts", "--json"],
          cwd: `${repo.root}/pkg`,
        });

        expect(result.exitCode).toBe(4);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain('"index.ts"');
      }).pipe(Effect.scoped),
  );

  it.live(
    "reads a path starting with ./ only against the working directory",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeShadowedProject;

        const result = yield* journey({
          args: ["inspect", "./src/b.ts", "--json"],
          cwd: `${repo.root}/pkg`,
        });

        expect(result.exitCode).toBe(4);
        expect(result.stderr).toContain('"./src/b.ts"');
      }).pipe(Effect.scoped),
  );
});
