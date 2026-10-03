import { Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeInterfaceProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat finds unstable interfaces", () => {
  it.live(
    "lists the file many others import in the terminal view of analyze",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeInterfaceProject;

        const result = yield* journey({ args: ["analyze"], cwd: repo.root });

        expect(result.exitCode).toBe(0);
        const lines = result.stdout.split("\n");
        const start = lines.indexOf(
          "Unstable interfaces (many files import them, and they keep changing)",
        );
        expect(lines.slice(start, start + 4)).toStrictEqual([
          "Unstable interfaces (many files import them, and they keep changing)",
          "fan-in  changes  ripple  file",
          "     5        5       5  src/api.ts",
          "fan-in: files that import it; ripple: of those, files that changed in the same commits",
        ]);
      }).pipe(Effect.scoped),
  );

  it.live("adds the interface and its dependents to the JSON", () =>
    Effect.gen(function* () {
      const repo = yield* makeInterfaceProject;

      const analyzed = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });

      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(analyzed.stdout),
      );
      expect(report.unstableInterfaces).toHaveLength(1);
      expect(report.unstableInterfaces[0]).toMatchObject({
        path: "src/api.ts",
        fanIn: 5,
        changes: 5,
        medianDependentChanges: 1,
        changedDependents: 5,
      });
      expect(report.dependencyDirection).toStrictEqual([]);
    }).pipe(Effect.scoped),
  );
});
