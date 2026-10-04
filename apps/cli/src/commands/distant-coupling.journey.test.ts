import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeCliqueProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat shows distant coupling in the terminal", () => {
  it.live(
    "lists distant couplings and the clique ahead of the plain coupling table",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCliqueProject;

        const result = yield* journey({ args: ["analyze"], cwd: repo.root });

        expect(result.exitCode).toBe(0);
        const lines = result.stdout.split("\n");
        const start = lines.indexOf(
          "Distant coupling (in different modules, or at least 3 directories apart within one module; tests excluded)",
        );
        expect(lines.slice(start, start + 8)).toStrictEqual([
          "Distant coupling (in different modules, or at least 3 directories apart within one module; tests excluded)",
          "score  degree  shared  imports  files",
          " 1.94    100%       5  hidden   packages/a/src/a.ts <-> packages/b/src/b.ts",
          " 1.94    100%       5  hidden   packages/a/src/a.ts <-> packages/c/src/c.ts",
          " 1.94    100%       5  hidden   packages/b/src/b.ts <-> packages/c/src/c.ts",
          "",
          "Change together (modules)",
          "packages/a + packages/b + packages/c: 3 modules of which every pair shares at least 100% of the smaller one's changes; 5 changes touched all of them",
        ]);
        expect(start).toBeLessThan(
          lines.indexOf(
            lines.find((line) => line.startsWith("Change coupling")) ?? "",
          ),
        );
      }).pipe(Effect.scoped),
  );

  it.live("marks the distant partners of an inspected file", () =>
    Effect.gen(function* () {
      const repo = yield* makeCliqueProject;

      const result = yield* journey({
        args: ["inspect", "packages/a/src/a.ts"],
        cwd: repo.root,
      });

      expect(result.stdout).toContain(
        "hidden  packages/b/src/b.ts (other module, distant)",
      );
    }).pipe(Effect.scoped),
  );
});

describe("codeheat reports distant coupling as JSON", () => {
  it.live(
    "adds the distant couplings, module couplings, and cliques to the JSON",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCliqueProject;

        const analyzed = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });
        const inspected = yield* journey({
          args: ["inspect", "packages/a/src/a.ts", "--json"],
          cwd: repo.root,
        });

        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(analyzed.stdout),
        );
        const result = yield* Schema.decodeUnknownEffect(InspectResult)(
          JSON.parse(inspected.stdout),
        );
        expect(report.distantCouplings).toHaveLength(3);
        expect(report.moduleCoupling).toHaveLength(3);
        expect(report.cliques.map(({ modules }) => modules)).toStrictEqual([
          ["packages/a", "packages/b", "packages/c"],
        ]);
        expect(
          result.matches[0]?.partners.map(({ distant }) => distant),
        ).toStrictEqual([true, true]);
      }).pipe(Effect.scoped),
  );
});
