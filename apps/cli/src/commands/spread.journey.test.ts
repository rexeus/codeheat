import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeCliqueProject, makeCoupledProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat reports how far a change spreads", () => {
  it.live(
    "puts the change radius and propagation cost into analyze --json",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeCliqueProject;

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(report.changeRadius).toStrictEqual({
          changes: 5,
          median: 3,
          p90: 3,
          local: 0,
        });
        expect(report.propagationCost).toStrictEqual({ cost: 1, files: 3 });
        expect(report.modules.map(({ radius }) => radius)).toStrictEqual([
          3, 3, 3,
        ]);
      }).pipe(Effect.scoped),
  );

  it.live("says it in two sentences under the summary line", () =>
    Effect.gen(function* () {
      const repo = yield* makeCliqueProject;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stdout.split("\n").slice(1, 4)).toStrictEqual([
        "A typical change touches 3 modules; 9 in 10 touch at most 3 modules; 0% stay in one module.",
        "Propagation cost 100%: a change to one file reaches that share of the other files within 3 couplings.",
        "",
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("states the radius of an inspected file's module", () =>
    Effect.gen(function* () {
      const repo = yield* makeCoupledProject;

      const terminal = yield* journey({
        args: ["inspect", "src/a.ts"],
        cwd: repo.root,
      });
      const json = yield* journey({
        args: ["inspect", "src/a.ts", "--json"],
        cwd: repo.root,
      });

      expect(terminal.stdout).toContain(
        "module src: 100% of 4 changes stay inside; a typical change touching it touches 1 module\n",
      );
      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(json.stdout),
      );
      expect(inspected.modules.map(({ radius }) => radius)).toStrictEqual([1]);
    }).pipe(Effect.scoped),
  );
});
