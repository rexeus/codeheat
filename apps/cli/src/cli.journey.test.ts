import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { journey } from "./testing/journey-harness.js";

describe("codeheat journeys", () => {
  it.effect("prints the version on stdout and exits 0", () =>
    Effect.gen(function* () {
      const result = yield* journey({ args: ["--version"] });

      expect(result.stdout).toMatch(/^codeheat v\d+\.\d+\.\d+/u);
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }),
  );

  it.effect("lists both commands in the help on stdout and exits 0", () =>
    Effect.gen(function* () {
      const result = yield* journey({ args: ["--help"] });

      expect(result.stdout).toContain("analyze");
      expect(result.stdout).toContain("inspect");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }),
  );
});

describe("codeheat usage errors", () => {
  it.effect(
    "exits 2 on a usage error and keeps stdout empty in --json mode",
    () =>
      Effect.gen(function* () {
        const result = yield* journey({
          args: ["analyze", "--json", "--limit", "-1"],
        });

        expect(result.stdout).toBe("");
        expect(result.stderr.split("\n").at(-1)).toContain(
          "codeheat: Invalid value for flag --limit",
        );
        expect(result.exitCode).toBe(2);
      }),
  );

  it.effect("exits 2 when inspect gets no file or glob", () =>
    Effect.gen(function* () {
      const result = yield* journey({ args: ["inspect"] });

      expect(result.stdout).toBe("");
      expect(result.stderr.split("\n").at(-1)).toBe(
        "codeheat: Missing required argument: file-or-glob",
      );
      expect(result.exitCode).toBe(2);
    }),
  );

  it.effect(
    "exits 2 on an unknown command without printing help to stdout",
    () =>
      Effect.gen(function* () {
        const result = yield* journey({ args: ["bogus"] });

        expect(result.stdout).toBe("");
        expect(result.stderr.split("\n").at(-1)).toBe(
          'codeheat: Unknown subcommand "bogus" for "codeheat"',
        );
        expect(result.exitCode).toBe(2);
      }),
  );
});
