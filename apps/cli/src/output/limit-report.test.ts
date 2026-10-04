import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/sample-report.js";
import { limitReport } from "./limit-report.js";

describe("limitReport", () => {
  it("cuts files and couplings separately to the limit and keeps their order", () => {
    const limited = limitReport(sampleReport(), 3);

    expect(limited.files.map((file) => file.rank)).toEqual([1, 2, 3]);
    expect(limited.couplings.map((coupling) => coupling.degree)).toEqual([
      0.75, 0.738, 0.679,
    ]);
  });
});

describe("limitReport entry points", () => {
  it("keeps the entry points and the territories whole", () => {
    const report = sampleReport();

    expect(report.entryPoints.length).toBeGreaterThan(1);
    expect(limitReport(report, 1).entryPoints).toStrictEqual(
      report.entryPoints,
    );
    expect(limitReport(report, 1).territories).toStrictEqual(
      report.territories,
    );
  });
});

describe("limitReport further lists", () => {
  it("cuts the least cohesive modules to the limit as well", () => {
    expect(
      limitReport(sampleReport(), 2).modules.map((module) => module.path),
    ).toEqual(["packages/shared", "apps/cli"]);
  });

  it("cuts the copy families to the limit as well", () => {
    const [family] = sampleReport().copyFamilies;
    const report = {
      ...sampleReport(),
      copyFamilies: family === undefined ? [] : [family, family, family],
    };

    expect(limitReport(report, 2).copyFamilies).toHaveLength(2);
    expect(limitReport(report, 0).copyFamilies).toHaveLength(3);
  });

  it("cuts the distant couplings to the limit as well", () => {
    const report = sampleReport();

    expect(report.distantCouplings).toHaveLength(4);
    expect(limitReport(report, 2).distantCouplings).toHaveLength(2);
    expect(limitReport(report, 0).distantCouplings).toHaveLength(4);
  });

  it("cuts the module couplings to the limit as well", () => {
    const report = sampleReport();

    expect(report.moduleCoupling).toHaveLength(8);
    expect(
      limitReport(report, 3).moduleCoupling.map(({ share }) => share),
    ).toEqual([0.4231, 0.3448, 0.3182]);
  });

  it("cuts the unstable interfaces and dependency directions to the limit as well", () => {
    const report = sampleReport();
    const [found] = report.unstableInterfaces;
    const [edge] = report.dependencyDirection;
    const many = {
      ...report,
      unstableInterfaces: found === undefined ? [] : [found, found, found],
      dependencyDirection: edge === undefined ? [] : [edge, edge, edge],
    };

    const limited = limitReport(many, 2);

    expect(limited.unstableInterfaces).toHaveLength(2);
    expect(limited.dependencyDirection).toHaveLength(2);
    expect(limitReport(many, 0).unstableInterfaces).toHaveLength(3);
  });
});

describe("limitReport totals", () => {
  it("keeps the totals of the untruncated report", () => {
    expect(limitReport(sampleReport(), 3).totals).toEqual({
      files: 36,
      contracts: 2,
      couplings: 9,
      modules: 5,
    });
  });

  it("keeps everything when the limit is 0", () => {
    const limited = limitReport(sampleReport(), 0);

    expect(limited.files).toHaveLength(36);
    expect(limited.couplings).toHaveLength(9);
    expect(limited.modules).toHaveLength(5);
  });

  it("keeps everything when the limit exceeds both lists", () => {
    const limited = limitReport(sampleReport(), 100);

    expect(limited.files).toHaveLength(36);
    expect(limited.couplings).toHaveLength(9);
  });
});
