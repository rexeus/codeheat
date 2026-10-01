import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { ParserUnavailable } from "../languages/language-adapters.js";
import { journey } from "../testing/journey-harness.js";
import { makeImportProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat finds hidden coupling", () => {
  it.live("marks which coupled files import each other in analyze --json", () =>
    Effect.gen(function* () {
      const repo = yield* makeImportProject;

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(result.stdout),
      );
      expect(
        report.couplings.map(({ a, b, imports }) => [a, b, imports]),
      ).toStrictEqual([
        ["src/api.ts", "src/config.ts", "none"],
        ["src/api.ts", "src/ui.ts", "b→a"],
        ["src/config.ts", "src/ui.ts", "none"],
      ]);
      const config = report.files.find(({ path }) => path === "src/config.ts");
      expect(config?.reasons).toContain(
        "changes with src/api.ts in 100% of its commits without an import between them",
      );
    }).pipe(Effect.scoped),
  );

  it.live("shows the import column in the terminal view of analyze", () =>
    Effect.gen(function* () {
      const repo = yield* makeImportProject;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stdout).toContain(
        "100%       4         0   100%   100%  hidden   src/api.ts <-> src/config.ts",
      );
      expect(result.stdout).toContain(
        "100%       4         0   100%   100%  b→a      src/api.ts <-> src/ui.ts",
      );
    }).pipe(Effect.scoped),
  );

  it.live("marks the partners of an inspected file from its own side", () =>
    Effect.gen(function* () {
      const repo = yield* makeImportProject;

      const result = yield* journey({
        args: ["inspect", "src/ui.ts", "--json"],
        cwd: repo.root,
      });

      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(result.stdout),
      );
      expect(
        inspected.matches[0]?.partners.map(({ path, imports }) => [
          path,
          imports,
        ]),
      ).toStrictEqual([
        ["src/api.ts", "file→partner"],
        ["src/config.ts", "none"],
      ]);
    }).pipe(Effect.scoped),
  );
});

describe("codeheat without a parser", () => {
  const unavailable = Effect.fail(
    new ParserUnavailable({
      reason: "Cannot find native binding",
    }),
  );

  it.live(
    "notes once on stderr that import relations are missing and reports the rest",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeImportProject;

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
          languageAdapters: unavailable,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe(
          "codeheat: the code parser is unavailable (Cannot find native binding); import relations and module depth are not reported",
        );
        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(report.couplings).toHaveLength(3);
        expect(report.couplings.map(({ imports }) => imports)).toStrictEqual([
          null,
          null,
          null,
        ]);
        expect(report.files.flatMap(({ reasons }) => reasons)).not.toContain(
          "changes with src/api.ts in 100% of its commits without an import between them",
        );
      }).pipe(Effect.scoped),
  );

  it.live("keeps inspect working without a parser", () =>
    Effect.gen(function* () {
      const repo = yield* makeImportProject;

      const result = yield* journey({
        args: ["inspect", "src/ui.ts", "--json"],
        cwd: repo.root,
        languageAdapters: unavailable,
      });

      expect(result.exitCode).toBe(0);
      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(result.stdout),
      );
      expect(
        inspected.matches[0]?.partners.map(({ imports }) => imports),
      ).toStrictEqual([null, null]);
    }).pipe(Effect.scoped),
  );
});
