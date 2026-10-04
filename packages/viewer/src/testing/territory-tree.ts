import type { Report } from "@codeheat/engine";

import {
  coupling,
  fileStats,
  reportOf,
  territoryFit,
  territoryNode,
} from "./reports.js";

const coreNodes = (): Report["territories"]["nodes"] => [
  territoryNode("t1", ".", { children: ["t2", "t5", "t6"], fit: null }),
  territoryNode("t2", "core", {
    parent: "t1",
    children: ["t3", "t4"],
    heatShare: 0.6,
    changes: 40,
    files: 4,
    splitReason: "src and rest change independently",
    description: "The core",
  }),
  territoryNode("t3", "core/src", {
    parent: "t2",
    heatShare: 0.4,
    changes: 30,
    files: 2,
    fit: territoryFit({
      detail: 2,
      containment: 0.3,
      partner: { territory: "t4", sharedChanges: 9, share: 0.3 },
      chronicFiles: 1,
      chronicShare: 0.5,
      hiddenPairs: 2,
      distantPairs: 3,
    }),
  }),
];

const otherNodes = (): Report["territories"]["nodes"] => [
  territoryNode("t4", "core/rest", {
    parent: "t2",
    heatShare: 0.2,
    changes: 12,
    files: 1,
    fit: territoryFit({ detail: 2, containment: 0.8 }),
  }),
  territoryNode("t5", "docs", {
    parent: "t1",
    heatShare: 0.1,
    changes: 10,
    files: 1,
    fit: territoryFit({ detail: 2, containment: 0.9 }),
  }),
  territoryNode("t6", "core", {
    parent: "t1",
    kind: "tests",
    heatShare: 0,
    changes: 8,
    files: 1,
    testFiles: 1,
    description: "test code",
    fit: territoryFit({ containment: null }),
  }),
];

/**
 * A report whose territories form a tree, with every detail: the root splits
 * into `core` (t2), `docs` (t5) and test code (t6); `core` splits into
 * `core/src` (t3) and `core/rest` (t4). Detail 1 shows t2, t5, t6; detail 2,
 * the recommended one, shows t3, t4, t5, t6. Files are listed hottest first,
 * a test file ahead of the code of t3 to show that code is named first.
 */
export const territoryTreeReport = (
  overrides: Partial<Report> = {},
): Report => {
  const nodes = [...coreNodes(), ...otherNodes()];
  return reportOf(
    [
      fileStats("core/src/a.test.ts", {
        territory: "t3",
        test: true,
        score: 0.95,
      }),
      fileStats("core/src/a.ts", { territory: "t3", score: 0.9 }),
      fileStats("core/rest/b.ts", { territory: "t4", score: 0.5 }),
      fileStats("docs/d.md", { territory: "t5", score: 0.2 }),
      fileStats("core/c.test.ts", { territory: "t6", test: true, score: 0.1 }),
    ],
    [
      coupling("core/src/a.ts", "core/rest/b.ts", {
        sharedCommits: 7,
        imports: "none",
      }),
      coupling("core/src/a.ts", "docs/d.md", {
        sharedCommits: 4,
        imports: "a→b",
      }),
      coupling("core/src/a.ts", "core/src/a.test.ts", {
        sharedCommits: 9,
        testPair: true,
      }),
      // A spec file that is nobody's own test, crossing the edge of t3.
      coupling("core/src/a.test.ts", "docs/d.md", { sharedCommits: 20 }),
    ],
    [],
    {
      territories: {
        recommended: 2,
        details: [
          { level: 1, ids: ["t2", "t5", "t6"] },
          { level: 2, ids: ["t3", "t4", "t5", "t6"] },
        ],
        nodes,
      },
      // Logical changes count before the size limit; the window's `couplingCommits` is what territories count.
      logicalChanges: { by: "commit", count: 500, largest: 80 },
      window: {
        since: "2025-09-29T12:00:00.000Z",
        until: "2026-09-29T12:00:00.000Z",
        commits: 600,
        realCommits: 550,
        couplingCommits: 120,
        lastCommitAt: "2026-09-28T15:30:00.000Z",
      },
      ...overrides,
    },
  );
};
