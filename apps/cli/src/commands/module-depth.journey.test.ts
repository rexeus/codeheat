import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { ParserUnavailable } from "../languages/language-adapters.js";
import { journey } from "../testing/journey-harness.js";
import { makeDepthProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat measures module depth", () => {
  it.live("reports the depth of a module in analyze --json", () =>
    Effect.gen(function* () {
      const repo = yield* makeDepthProject;

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });

      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(result.stdout),
      );
      expect(
        report.modules.map(({ path, depth }) => [path, depth]),
      ).toStrictEqual([
        ["packages/app", null],
        [
          "packages/lib",
          { exports: 2, implementationLines: 4, linesPerExport: 2 },
        ],
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("lists the shallowest ranked modules in the terminal view", () =>
    Effect.gen(function* () {
      const repo = yield* makeDepthProject;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stdout).toContain(
        [
          "Shallowest modules",
          "lines/export  exports  lines  module",
          "           2        2      4  packages/lib",
        ].join("\n"),
      );
    }).pipe(Effect.scoped),
  );
});

describe("codeheat shows the depth of an inspected file's module", () => {
  it.live("in the terminal and in the JSON", () =>
    Effect.gen(function* () {
      const repo = yield* makeDepthProject;

      const terminal = yield* journey({
        args: ["inspect", "packages/lib/src/impl.ts"],
        cwd: repo.root,
      });
      const json = yield* journey({
        args: ["inspect", "packages/lib/src/impl.ts", "--json"],
        cwd: repo.root,
      });

      expect(terminal.stdout).toContain(
        "module packages/lib depth: 2 exports over 4 lines, 2 lines per export",
      );
      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(json.stdout),
      );
      expect(inspected.modules.map(({ depth }) => depth)).toStrictEqual([
        { exports: 2, implementationLines: 4, linesPerExport: 2 },
      ]);
    }).pipe(Effect.scoped),
  );
});

describe("codeheat without a parser", () => {
  it.live("leaves the depth null", () =>
    Effect.gen(function* () {
      const repo = yield* makeDepthProject;

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
        languageAdapters: Effect.fail(
          new ParserUnavailable({ reason: "Cannot find native binding" }),
        ),
      });

      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(result.stdout),
      );
      expect(report.modules.map(({ depth }) => depth)).toStrictEqual([
        null,
        null,
      ]);
    }).pipe(Effect.scoped),
  );
});
