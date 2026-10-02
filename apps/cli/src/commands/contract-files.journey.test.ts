import { InspectResult, Report } from "@codeheat/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeContractProject } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codeheat couples contract files with code", () => {
  it.live(
    "lists a contract among the couplings in analyze --json, never among the hotspots",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeContractProject;

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        const report = yield* Schema.decodeUnknownEffect(Report)(
          JSON.parse(result.stdout),
        );
        expect(report.files.map(({ path }) => path)).toStrictEqual([
          "src/orders.ts",
        ]);
        expect(
          report.couplings.map(({ a, b, kinds }) => [a, b, kinds]),
        ).toStrictEqual([
          ["api/orders.tsp", "src/orders.ts", { a: "contract", b: "code" }],
        ]);
        expect(report.contracts.map(({ path }) => path)).toStrictEqual([
          "api/orders.tsp",
        ]);
      }).pipe(Effect.scoped),
  );

  it.live("marks the contract in the terminal view of analyze", () =>
    Effect.gen(function* () {
      const repo = yield* makeContractProject;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stdout).toContain("1 files, 1 contract file");
      expect(result.stdout).toContain(
        "100%       4         2   100%   100%  -        api/orders.tsp (contract) <-> src/orders.ts",
      );
    }).pipe(Effect.scoped),
  );
});

describe("codeheat shows contract partners and honors exclude", () => {
  it.live("marks a contract partner in inspect", () =>
    Effect.gen(function* () {
      const repo = yield* makeContractProject;

      const text = yield* journey({
        args: ["inspect", "src/orders.ts"],
        cwd: repo.root,
      });
      const json = yield* journey({
        args: ["inspect", "src/orders.ts", "--json"],
        cwd: repo.root,
      });

      expect(text.stdout).toContain("api/orders.tsp (contract)");
      const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
        JSON.parse(json.stdout),
      );
      expect(
        inspected.matches[0]?.partners.map(({ path, kind }) => [path, kind]),
      ).toStrictEqual([["api/orders.tsp", "contract"]]);
    }).pipe(Effect.scoped),
  );

  it.live("lets --exclude remove contracts from the analysis", () =>
    Effect.gen(function* () {
      const repo = yield* makeContractProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--exclude", "**/*.tsp"],
        cwd: repo.root,
      });

      const report = yield* Schema.decodeUnknownEffect(Report)(
        JSON.parse(result.stdout),
      );
      expect(report.contracts).toStrictEqual([]);
      expect(report.couplings).toStrictEqual([]);
    }).pipe(Effect.scoped),
  );
});
