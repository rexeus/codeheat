import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeTempDirectory } from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import { makeCoupledProject, withoutGitOnPath } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat exit codes", () => {
  it.live("exits 3 outside a git repository", () =>
    Effect.gen(function* () {
      const directory = yield* makeTempDirectory;

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: directory,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(3);
    }).pipe(Effect.scoped),
  );

  it.live("exits 4 when no inspect pattern matches", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["inspect", "lib/**", "--json"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(4);
    }).pipe(Effect.scoped),
  );

  it.live("exits 2 on an invalid --since", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const result = yield* journey({
        args: ["analyze", "--since", "soon"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );

  it.live("exits 3 without git on PATH", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;
      yield* withoutGitOnPath;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stderr).toBe(
        "codeheat: git was not found on PATH; codeheat needs git",
      );
      expect(result.exitCode).toBe(3);
    }).pipe(Effect.scoped),
  );

  it.live("escapes control characters in a reported path", () =>
    Effect.gen(function* () {
      const directory = yield* makeTempDirectory;
      const hostile = join(directory, "\u001B[31mred");
      mkdirSync(hostile);

      const result = yield* journey({ args: ["analyze"], cwd: hostile });

      expect(result.stderr).toBe(
        `codeheat: not a git repository: ${directory}/\\u001b[31mred`,
      );
    }).pipe(Effect.scoped),
  );
});
