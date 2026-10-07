import type { Module, Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { heatLines, overTimeSection } from "./over-time-view.js";
import { makeStyle } from "./style.js";

const plainSection = (report: Report): ReadonlyArray<string> =>
  overTimeSection(report, makeStyle(false));

/** The sample report with the modules' erosion replaced. */
const withErosion = (
  verdict: NonNullable<Report["erosion"]>["verdict"],
  windows = 6,
  inactiveSince: string | null = null,
): Report => {
  const report = sampleReport();
  return {
    ...report,
    erosion: {
      verdict,
      inactiveSince,
      windows,
      locality: report.erosion?.locality ?? null,
      propagationCost: null,
    },
  };
};

/** The sample report with the verdict's trend replaced. */
const withTrend = (
  trend: Report["verdict"]["trend"],
  judged?: ReadonlyArray<string>,
): Report => {
  const report = sampleReport();
  return {
    ...report,
    verdict: {
      ...report.verdict,
      trend,
      judged: judged ?? report.verdict.judged,
    },
  };
};

describe("overTimeSection", () => {
  it("states the verdict's trend, the modules' erosion, the modules losing cohesion, the hotspots by age, and the fixes", () => {
    expect(plainSection(sampleReport())).toStrictEqual([
      "Over time (since 2025-03)",
      "Eroding: the territories the verdict judges keep less and less of their changes inside over 6 quarters.",
      "Modules: changes that stay in one module fell from 88% to 53% over the active period of 6 quarters.",
      "  packages/billing: cohesion 84% to 32% over 6 quarters",
      "Hotspots by age: 2 chronic files (hot in at least half of its windows, so a design problem) and 1 acute file (hot only lately, so current work).",
      "  #1 packages/billing/src/invoice.ts: hot in 5 of 6 windows",
      "  #2 packages/billing/src/tax.ts: hot in 4 of 6 windows",
      "Fixes: 23% of 178 changes fix something; most in packages/billing (31%, 9 of its 23 fixes also touched another module).",
      "",
    ]);
  });

  it("states the verdict's trend, not the modules' erosion, when the two differ", () => {
    const report = {
      ...withErosion("holding"),
      verdict: withTrend("improving").verdict,
    };

    expect(plainSection(report).slice(1, 3)).toStrictEqual([
      "Improving: the territories the verdict judges keep more and more of their changes inside over 6 quarters.",
      "Modules: no lasting change in the share of changes that stay in one module (88% to 53%) over the active period of 6 quarters.",
    ]);
    expect(plainSection(withTrend("holding"))[1]).toBe(
      "Holding: no lasting change in how much of their changes the territories the verdict judges keep inside over 6 quarters.",
    );
    expect(plainSection(withErosion("improving"))[2]).toBe(
      "Modules: changes that stay in one module rose from 88% to 53% over the active period of 6 quarters.",
    );
  });

  it("says since when a repository that has gone quiet has been quiet", () => {
    const [, trend] = plainSection(
      withErosion("eroding", 6, "2026-04-02T00:00:00.000Z"),
    );

    expect(trend).toBe(
      "Eroding: the territories the verdict judges keep less and less of their changes inside over 6 quarters (quiet since 2026-04: fewer than 10 changes a window).",
    );
  });

  it("says why there is no trend yet", () => {
    expect(plainSection(withTrend("unknown"))[1]).toBe(
      "No trend yet: it needs 5 windows with at least 10 changes.",
    );
    expect(plainSection(withTrend("unknown", []))[1]).toBe(
      "No trend yet: no territory has enough changes to judge.",
    );
    expect(plainSection(withErosion("unknown", 1))[2]).toBe(
      "Modules: no trend yet, 1 window has at least 10 changes, and a trend needs 3.",
    );
  });
});

describe("overTimeSection parts", () => {
  it("names windows by their length when they are not about a quarter", () => {
    const report = sampleReport();
    const [first] = report.series;
    const longer = {
      ...report,
      series: report.series.map((window) =>
        Object.assign({}, window, {
          since: first?.since ?? window.since,
          until: "2026-09-29T12:00:00.000Z",
        }),
      ),
    };

    expect(plainSection(longer)[2]).toContain("of 6 18-month windows");
  });

  it("lists a module only when it is still changing and its cohesion fell by more than chance explains", () => {
    const report = sampleReport();
    const moduleLines = (erosion: Partial<NonNullable<Module["erosion"]>>) =>
      plainSection({
        ...report,
        modules: report.modules.map((module) =>
          module.path === "packages/billing" && module.erosion !== null
            ? Object.assign({}, module, {
                erosion: Object.assign({}, module.erosion, erosion),
              })
            : module,
        ),
      }).filter((line) => line.startsWith("  packages/"));

    expect(moduleLines({})).toHaveLength(1);
    expect(moduleLines({ recent: false })).toStrictEqual([]);
    expect(moduleLines({ verdict: "holding" })).toStrictEqual([]);
  });

  it("lists the chronic hotspots with how often they were hot", () => {
    const report = sampleReport();
    const files = report.files.map((file, index) =>
      index < 2
        ? {
            ...file,
            heat: { kind: "chronic" as const, hotWindows: 5, windows: 6 },
          }
        : file,
    );

    expect(
      plainSection({ ...report, files }).filter(
        (line) => line.startsWith("Hotspots by age") || line.startsWith("  #"),
      ),
    ).toStrictEqual([
      "Hotspots by age: 2 chronic files (hot in at least half of its windows, so a design problem) and 1 acute file (hot only lately, so current work).",
      "  #1 packages/billing/src/invoice.ts: hot in 5 of 6 windows",
      "  #2 packages/billing/src/tax.ts: hot in 5 of 6 windows",
    ]);
  });
});

describe("overTimeSection fixes", () => {
  it("says the fixes are unknown, not zero, for a team without commit conventions", () => {
    const report = sampleReport();

    expect(
      plainSection({
        ...report,
        fixDensity: {
          changes: 178,
          fixes: 3,
          conventional: 0.02,
          known: false,
          share: null,
        },
      }).at(-2),
    ).toBe(
      "Fixes: unknown, as only 2% of the commit subjects match a fix rule or a Conventional Commits type.",
    );
  });

  it("is empty without a series, a hotspot by age, or changes to read fixes from", () => {
    const report = sampleReport();

    expect(
      plainSection({
        ...report,
        series: [],
        erosion: null,
        modules: report.modules.map((module) => ({ ...module, erosion: null })),
        files: report.files.map((file) => ({ ...file, heat: null })),
        fixDensity: { ...report.fixDensity, changes: 0 },
      }),
    ).toStrictEqual([]);
  });
});

describe("heatLines", () => {
  it("explains a chronic hotspot as a design problem and an acute one as current work", () => {
    expect(
      heatLines({ heat: { kind: "chronic", hotWindows: 4, windows: 5 } }),
    ).toStrictEqual([
      "chronic hotspot: hot in 4 of 5 windows, so a design problem rather than current work",
    ]);
    expect(
      heatLines({ heat: { kind: "acute", hotWindows: 2, windows: 5 } }),
    ).toStrictEqual([
      "acute hotspot: hot in 2 of 5 windows, only lately, so current work",
    ]);
  });

  it("says nothing for a file that is neither", () => {
    expect(heatLines({ heat: null })).toStrictEqual([]);
  });
});
