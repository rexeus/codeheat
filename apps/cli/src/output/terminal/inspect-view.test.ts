import type { InspectResult, Module } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { renderInspect } from "./inspect-view.js";
import { makeStyle } from "./style.js";

const entry: InspectResult["matches"][number] = {
  path: "packages/billing/src/invoice.ts",
  test: false,
  rank: 1,
  score: 0.97,
  revisions: 48,
  changes: 48,
  linesAdded: 384,
  linesDeleted: 672,
  breadth: 14,
  module: "packages/billing",
  territory: "t2",
  loc: 964,
  complexity: { total: 1900, mean: 1.97, max: 9 },
  reasons: ["changed in 48 commits (#1 of 36)"],
  trend: null,
  heat: null,
  copyFamily: null,
  entryPoints: [],
  of: 36,
  partners: [
    {
      path: "packages/billing/src/invoice.test.ts",
      sharedCommits: 31,
      probability: 0.646,
      kind: "code" as const,
      testPair: true,
      crossesModule: false,
      distant: false,
      imports: "both",
    },
    {
      path: "packages/billing/src/tax.ts",
      sharedCommits: 24,
      probability: 0.5,
      kind: "code" as const,
      testPair: false,
      crossesModule: false,
      distant: false,
      imports: "file→partner",
    },
    {
      path: "packages/web/src/checkout.ts",
      sharedCommits: 12,
      probability: 0.25,
      kind: "code" as const,
      testPair: false,
      crossesModule: true,
      distant: true,
      imports: "none",
    },
  ],
};

const billing: Module = {
  path: "packages/billing",
  kind: "package",
  files: 9,
  testOnly: false,
  commits: 74,
  localCommits: 41,
  cohesion: 0.5541,
  radius: 1,
  partners: [
    { path: "packages/web", sharedCommits: 20, contractsOnly: false },
    { path: "packages/auth", sharedCommits: 9, contractsOnly: false },
  ],
  entryPoints: ["packages/billing/src/index.ts"],
  interfaceCommits: 9,
  implementationCommits: 71,
  leakage: 0.1268,
  leakyInterface: false,
  depth: null,
  trend: null,
  erosion: null,
  fixDensity: null,
};

const result = (
  matches: InspectResult["matches"],
  modules: InspectResult["modules"] = [billing],
  territories: InspectResult["territories"] = [],
): InspectResult => ({
  schemaVersion: 1,
  window: {
    since: "2025-09-29T12:00:00.000Z",
    until: "2026-09-29T12:00:00.000Z",
    commits: 212,
    realCommits: 212,
    couplingCommits: 198,
    lastCommitAt: null,
  },
  matches,
  modules,
  territories,
  contractFiles: [],
  unmatched: [],
});

describe("renderInspect", () => {
  it("shows the standing, metrics, reasons and partners of a file", () => {
    expect(renderInspect(result([entry]), makeStyle(false))).toBe(
      [
        "2025-09-29 to 2026-09-29",
        "",
        "packages/billing/src/invoice.ts",
        "rank #1 of 36, score 0.97",
        "48 revisions, 14 co-changed files, +384 -672 lines, 964 loc",
        "indentation complexity 1900 (mean 1.97, max 9)",
        "module packages/billing: 55% of 74 changes stay inside; a typical change touching it touches 1 module, most often with packages/web (20)",
        "- changed in 48 commits (#1 of 36)",
        "",
        "Changes together with",
        "co-change  shared  import   partner",
        "      65%      31  both     packages/billing/src/invoice.test.ts (test)",
        "      50%      24  imports  packages/billing/src/tax.ts",
        "      25%      12  hidden   packages/web/src/checkout.ts (other module, distant)",
      ].join("\n"),
    );
  });

  it("shows the complexity mean with at most two decimals", () => {
    const precise = {
      ...entry,
      complexity: { total: 261, mean: 1.1809, max: 6 },
    };

    expect(renderInspect(result([precise]), makeStyle(false))).toContain(
      "indentation complexity 261 (mean 1.18, max 6)",
    );
  });

  it("separates several matches and says when a file has no partners", () => {
    const lonely = { ...entry, path: "lonely.ts", partners: [] };

    const view = renderInspect(result([entry, lonely]), makeStyle(false));

    expect(view).toContain("\n\nlonely.ts\n");
    expect(view.split("\n").at(-1)).toBe(
      "No change coupling above the thresholds.",
    );
  });

  it("escapes control characters in paths", () => {
    const hostile = { ...entry, path: "a\u001B[2J.ts", module: "m\u001B[2J" };
    const hostileModule = { ...billing, path: "m\u001B[2J" };

    const view = renderInspect(
      result([hostile], [hostileModule]),
      makeStyle(false),
    );

    expect(view).toContain("a\\u001b[2J.ts");
    expect(view).toContain("module m\\u001b[2J:");
    expect(view).not.toContain("\u001B");
  });
});

const markedWith = (heat: InspectResult["matches"][number]["heat"]) =>
  renderInspect(result([{ ...entry, heat }]), makeStyle(false)).split("\n");

describe("renderInspect hotspot age", () => {
  it("marks a chronic or acute hotspot under the file's metrics", () => {
    expect(markedWith({ kind: "chronic", hotWindows: 4, windows: 4 })[6]).toBe(
      "chronic hotspot: hot in 4 of 4 windows, so a design problem rather than current work",
    );
    expect(markedWith({ kind: "acute", hotWindows: 2, windows: 5 })[6]).toBe(
      "acute hotspot: hot in 2 of 5 windows, only lately, so current work",
    );
    expect(markedWith(null).join("\n")).not.toContain("hotspot");
  });
});

describe("renderInspect modules", () => {
  it("says when the module has no counted changes or no partner", () => {
    const quiet: Module = {
      ...billing,
      commits: 0,
      cohesion: null,
      partners: [],
    };
    const alone: Module = {
      ...billing,
      commits: 8,
      cohesion: 1,
      radius: 1,
      partners: [],
    };

    expect(renderInspect(result([entry], [quiet]), makeStyle(false))).toContain(
      "module packages/billing: no counted changes\n",
    );
    expect(renderInspect(result([entry], [alone]), makeStyle(false))).toContain(
      "module packages/billing: 100% of 8 changes stay inside; a typical change touching it touches 1 module\n",
    );
  });

  it("states the module's depth under its cohesion, when it was measured", () => {
    const deep: Module = {
      ...billing,
      depth: { exports: 6, implementationLines: 3105, linesPerExport: 517.5 },
    };
    const silent: Module = { ...deep, commits: 0, cohesion: null };

    expect(renderInspect(result([entry], [deep]), makeStyle(false))).toContain(
      "touches 1 module, most often with packages/web (20)\nmodule packages/billing depth: 6 exports over 3105 lines, 517.5 lines per export\n",
    );
    expect(
      renderInspect(result([entry], [silent]), makeStyle(false)),
    ).toContain(
      "module packages/billing: no counted changes\nmodule packages/billing depth: 6 exports",
    );
    expect(renderInspect(result([entry]), makeStyle(false))).not.toContain(
      "depth",
    );
  });

  it("prints one module line per match, each from its own module", () => {
    const web = { ...entry, path: "packages/web/a.ts", module: "packages/web" };
    const webModule: Module = {
      ...billing,
      path: "packages/web",
      cohesion: 0.5,
      commits: 10,
      partners: [],
    };

    const view = renderInspect(
      result([entry, web], [billing, webModule]),
      makeStyle(false),
    );

    expect(view).toContain("module packages/billing: 55%");
    expect(view).toContain(
      "module packages/web: 50% of 10 changes stay inside; a typical change touching it touches 1 module\n",
    );
  });
});

describe("renderInspect copy family", () => {
  it("names the copies of a file right after its reasons", () => {
    const copied = {
      ...entry,
      copyFamily: {
        files: [
          "packages/billing/src/invoice.ts",
          "packages/web/src/invoice.ts",
        ],
        similarity: { min: 0.6, max: 0.6 },
        sharedChanges: 7,
        changesToAll: 7,
        testOnly: false,
      },
    };

    const lines = renderInspect(result([copied]), makeStyle(false)).split("\n");

    expect(lines.slice(7, 9)).toEqual([
      "- changed in 48 commits (#1 of 36)",
      "changes with its 1 copy: packages/web/src/invoice.ts (7 changes touched both)",
    ]);
  });
});

describe("renderInspect import relations", () => {
  it("shows an unknown import relation as a dash and an imported file as imported by", () => {
    const relations = [null, "partner→file", null] as const;
    const partners = entry.partners.map((partner, index) => ({
      ...partner,
      imports: relations[index] ?? null,
    }));

    const view = renderInspect(
      result([{ ...entry, partners }]),
      makeStyle(false),
    );

    expect(view).toContain(
      "      65%      31  -            packages/billing/src/invoice.test.ts (test)",
    );
    expect(view).toContain(
      "      50%      24  imported by  packages/billing/src/tax.ts",
    );
  });

  it("does not call a file's test hidden, in text or in color", () => {
    const partners = [
      {
        path: "tax.test.ts",
        sharedCommits: 3,
        probability: 0.5,
        kind: "code" as const,
        testPair: true,
        crossesModule: false,
        distant: false,
        imports: "none" as const,
      },
    ];

    const plainView = renderInspect(
      result([{ ...entry, partners }]),
      makeStyle(false),
    );
    const colorView = renderInspect(
      result([{ ...entry, partners }]),
      makeStyle(true),
    );

    expect(plainView).toContain("none    tax.test.ts (test)");
    expect(plainView).not.toContain("hidden");
    expect(colorView).not.toContain("\u001B[1mnone");
  });
});

describe("renderInspect contract partners", () => {
  it("marks a contract partner, which comes before any other mark", () => {
    const partners = [
      {
        path: "api/orders.tsp",
        sharedCommits: 9,
        probability: 0.5,
        kind: "contract" as const,
        testPair: false,
        crossesModule: true,
        distant: false,
        imports: null,
      },
    ];

    const view = renderInspect(
      result([{ ...entry, partners }]),
      makeStyle(false),
    );

    expect(view).toContain("-       api/orders.tsp (contract)");
  });
});

describe("renderInspect contract-only partners", () => {
  it("marks a module partner that holds only contract files", () => {
    const module: Module = {
      ...billing,
      partners: [{ path: "spec", sharedCommits: 20, contractsOnly: true }],
    };

    const view = renderInspect(result([entry], [module]), makeStyle(false));

    expect(view).toContain("most often with spec (contracts) (20)");
  });
});
