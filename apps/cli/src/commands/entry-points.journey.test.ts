import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeLeakyProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat says where to start", () => {
  it.live(
    "puts the section right after the summary of analyze, naming the territory and what to do",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeLeakyProject;

        const result = yield* journey({ args: ["analyze"], cwd: repo.root });

        expect(result.exitCode).toBe(0);
        const lines = result.stdout.split("\n");
        const start = lines.indexOf("Where to start");
        expect(lines[start - 2]).toMatch(/^Territories: /u);
        expect(lines.slice(start + 1, start + 5)).toStrictEqual([
          "1. boundary  billing, web",
          "   The boundary between billing and web does not hold: changes in one keep reaching into the other.",
          expect.stringMatching(
            /^ {3}\d+% of the code's heat; \d+% of their 13 changes stay inside, 7 changes touched both$/u,
          ),
          "   Move a boundary: redraw the boundary between billing and web, or give what they share a home of its own.",
        ]);
        expect(lines.indexOf("Hotspots")).toBeGreaterThan(start);
      }).pipe(Effect.scoped),
  );
});

describe("codeheat reports entry points as JSON", () => {
  it.live(
    "adds the ranked entry points to the JSON report, and nothing else to stdout",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeLeakyProject;

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        const [first] = report.entryPoints;
        const billing = report.territories.nodes.find(
          ({ path }) => path === "billing",
        );
        const web = report.territories.nodes.find(({ path }) => path === "web");
        expect(report.entryPoints.map(({ rank }) => rank)).toStrictEqual([1]);
        expect(first).toMatchObject({
          rank: 1,
          kind: "boundary",
          files: [],
          evidence: { changes: 13, sharedChanges: 7 },
        });
        expect(new Set(first?.territories)).toStrictEqual(
          new Set([billing?.id, web?.id]),
        );
        expect(
          first?.findings.map(({ territories }) => territories.length),
        ).toStrictEqual([2, 1, 1]);
        expect(report.schemaVersion).toBe(1);
      }).pipe(Effect.scoped),
  );
});

describe("codeheat names the entry points of a file", () => {
  it.live("names the entry points of an inspected file", () =>
    Effect.gen(function* () {
      const repo = yield* makeLeakyProject;

      const text = yield* journey({
        args: ["inspect", "billing/b.ts"],
        cwd: repo.root,
      });
      const json = yield* journey({
        args: ["inspect", "billing/b.ts", "--json"],
        cwd: repo.root,
      });

      expect(text.stdout).toContain(
        "territory billing: 46% of 13 changes stay inside, most often with web (7)",
      );
      expect(text.stdout).toContain(
        "entry point #1 (boundary): The boundary between billing and web does not hold: changes in one keep reaching into the other.",
      );
      const result = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(json.stdout),
      );
      expect(
        result.matches[0]?.entryPoints.map(({ kind }) => kind),
      ).toStrictEqual(["boundary"]);
      expect(result.territories.map(({ path }) => path)).toStrictEqual([
        "billing",
        "web",
      ]);
    }).pipe(Effect.scoped),
  );
});
