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
