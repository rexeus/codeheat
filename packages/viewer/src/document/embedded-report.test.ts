import { describe, expect, it } from "vitest";

import { fileStats, reportOf } from "../testing/reports.js";
import { parseReport, serializeReport } from "./embedded-report.js";

describe("embedded report", () => {
  const report = reportOf([fileStats("src/<a>&b.ts")]);

  it("restores the report from its serialized form", () => {
    expect(parseReport(serializeReport(report))).toEqual(report);
  });

  it("never emits a less-than sign", () => {
    expect(serializeReport(report)).not.toContain("<");
  });

  it("gives a report from before the verdict, territories, and entry points empty design-fit fields", () => {
    const {
      verdict: _verdict,
      territories: _territories,
      entryPoints: _entryPoints,
      territoryCoupling: _territoryCoupling,
      territoryCliques: _territoryCliques,
      changeRadius: _changeRadius,
      propagationCost: _propagationCost,
      erosion: _erosion,
      ...older
    } = report;

    const { maxCoupledTerritories: _cap, ...limits } = report.thresholds;

    expect(
      parseReport(JSON.stringify({ ...older, thresholds: limits })),
    ).toEqual({
      ...older,
      thresholds: report.thresholds,
      verdict: {
        level: "unknown",
        reason: "no-territories",
        leakShare: 0,
        coverage: 0,
        judged: [],
        leaking: [],
        eroding: false,
        trend: "unknown",
      },
      territories: { recommended: 0, details: [], nodes: [] },
      entryPoints: [],
      territoryCoupling: [],
      territoryCliques: [],
      changeRadius: null,
      propagationCost: null,
      erosion: null,
    });
  });

  it("rejects a document of another schema version", () => {
    const future = JSON.stringify({ ...report, schemaVersion: 2 });

    expect(() => parseReport(future)).toThrow(/not a codeheat report/u);
  });

  it("rejects JSON that is not a report", () => {
    expect(() => parseReport("[]")).toThrow(/not a codeheat report/u);
    expect(() => parseReport('{"schemaVersion":1}')).toThrow(
      /not a codeheat report/u,
    );
  });
});
