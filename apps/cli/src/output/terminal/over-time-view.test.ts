import type { Report } from "@codeheat/engine";
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
): Report => {
  const report = sampleReport();
  return {
    ...report,
    erosion: {
      verdict,
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
      "Eroding: changes that stay in one module went from 70% to 59% over 4 quarters.",
      "  packages/billing: cohesion 71% to 41% over 4 quarters",
      "  packages/web: cohesion 60% to 46% over 4 quarters",
      "Hotspots by age: 2 chronic files (hot in most windows, so a design problem) and 1 acute file (hot only lately, so current work).",
      "  #1 packages/billing/src/invoice.ts: hot in 4 of 4 windows",
      "  #2 packages/billing/src/tax.ts: hot in 3 of 4 windows",
      "Fixes: 23% of 178 changes fix something; most in packages/billing (31%, 9 of its 23 fixes also touched another module).",
      "",
    ]);
  });

  it("says improving or holding in the same terms", () => {
    expect(plainSection(withVerdict("improving"))[1]).toBe(
      "Improving: changes that stay in one module went from 70% to 59% over 4 quarters.",
    );
    expect(plainSection(withVerdict("holding"))[1]).toBe(
      "Holding: changes that stay in one module went from 70% to 59% over 4 quarters.",
    );
  });

  it("says no recent activity, and never improving, for a repository that has gone quiet", () => {
    const [, verdict] = plainSection(withVerdict("no recent activity"));

    expect(verdict).toBe(
      "No recent activity: neither of the last two windows has 10 changes, so there is no verdict on the present.",
    );
  });

  it("says why there is no verdict yet", () => {
    expect(plainSection(withVerdict("unknown", 2))[1]).toBe(
      "No verdict yet: 2 windows have at least 10 changes, and a trend needs 3.",
    );
    expect(plainSection(withVerdict("unknown", 1))[1]).toBe(
      "No verdict yet: 1 window has at least 10 changes, and a trend needs 3.",
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

    expect(plainSection(longer)[1]).toContain("over 4 12-month windows");
  });

  it("leaves a module out that stopped changing, or whose cohesion fell less than the shift that counts", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      module.erosion === null
        ? module
        : {
            ...module,
            erosion: {
              ...module.erosion,
              recent: module.path !== "packages/billing",
              to: module.path === "packages/web" ? 0.55 : module.erosion.to,
            },
          },
    );

    expect(
      plainSection({ ...report, modules }).filter((line) =>
        line.startsWith("  packages/"),
      ),
    ).toStrictEqual([]);
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
      "Fixes: unknown, as only 2% of the commit subjects follow a convention.",
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
