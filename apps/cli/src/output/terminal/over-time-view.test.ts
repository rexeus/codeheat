import type { Module, Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { heatLines, overTimeSection } from "./over-time-view.js";
import { makeStyle } from "./style.js";

const plainSection = (report: Report): ReadonlyArray<string> =>
  overTimeSection(report, makeStyle(false));

/** The sample report with its verdict replaced. */
const withVerdict = (
  verdict: NonNullable<Report["erosion"]>["verdict"],
  windows = 4,
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

describe("overTimeSection", () => {
  it("states the verdict with the numbers behind it, the modules losing cohesion, the hotspots by age, and the fixes", () => {
    expect(plainSection(sampleReport())).toStrictEqual([
      "Over time",
      "Eroding: changes that stay in one module fell from 78% to 51% over the active period of 4 quarters.",
      "  packages/billing: cohesion 79% to 29% over 4 quarters",
      "Hotspots by age: 0 chronic files (hot in most windows, so a design problem) and 2 acute files (hot only lately, so current work).",
      "Fixes: 23% of 178 changes fix something; most in packages/billing (31%, 9 of its 23 fixes also touched another module).",
      "",
    ]);
  });

  it("says improving or holding in the same terms", () => {
    expect(plainSection(withVerdict("improving"))[1]).toBe(
      "Improving: changes that stay in one module rose from 78% to 51% over the active period of 4 quarters.",
    );
    expect(plainSection(withVerdict("holding"))[1]).toBe(
      "Holding: no lasting change in the share of changes that stay in one module (78% to 51%) over the active period of 4 quarters.",
    );
  });

  it("judges the active period of a repository that has gone quiet, and says since when", () => {
    const [, verdict] = plainSection(
      withVerdict("eroding", 4, "2026-04-02T00:00:00.000Z"),
    );

    expect(verdict).toBe(
      "Eroding: changes that stay in one module fell from 78% to 51% over the active period of 4 quarters (quiet since 2026-04: fewer than 10 changes a window).",
    );
  });

  it("says why there is no verdict yet", () => {
    expect(plainSection(withVerdict("unknown", 2))[1]).toBe(
      "No verdict yet: 2 windows have at least 10 changes, and a trend needs 3.",
    );
    expect(plainSection(withVerdict("unknown", 1))[1]).toBe(
      "No verdict yet: 1 window has at least 10 changes, and a trend needs 3.",
    );
    expect(
      plainSection(withVerdict("unknown", 0, "2025-09-29T12:00:00.000Z"))[1],
    ).toBe(
      "No verdict yet: 0 windows have at least 10 changes, and a trend needs 3 (quiet since 2025-09: fewer than 10 changes a window).",
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

    expect(plainSection(longer)[1]).toContain("of 4 12-month windows");
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
      "Hotspots by age: 2 chronic files (hot in most windows, so a design problem) and 1 acute file (hot only lately, so current work).",
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
