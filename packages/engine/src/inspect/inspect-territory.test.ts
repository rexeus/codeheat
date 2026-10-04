import { describe, expect, it } from "vitest";

import type { EntryPoint } from "../report/entry-point.js";
import type { Report } from "../report/report.js";
import { fileRecord } from "../testing/file-record.js";
import {
  DEFAULT_THRESHOLDS,
  NO_DESIGN_FINDINGS,
} from "../testing/report-defaults.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { inspect } from "./inspect.js";

const NODES = [
  territoryRecord("t1", "folder", null, ["t2", "t3", "t4"]),
  Object.assign(territoryRecord("t2", "package", "t1"), {
    fit: fitRecord({
      containment: 0.4,
      partner: { territory: "t3", sharedChanges: 9, share: 0.3 },
    }),
  }),
  Object.assign(territoryRecord("t3", "package", "t1"), {
    fit: fitRecord({ containment: 0.8 }),
  }),
  territoryRecord("t4", "package", "t1"),
];

const boundary: EntryPoint = {
  rank: 1,
  kind: "boundary",
  score: 0.2,
  territories: ["t2"],
  files: [],
  evidence: {},
  verdict: "Leaks.",
  designMove: "Move it.",
  findings: [],
};

const reportOf = (): Report => ({
  schemaVersion: 1,
  tool: { name: "codeheat", version: "0.0.0-test" },
  generatedAt: "2026-06-01T12:00:00.000Z",
  repository: { name: "repo", head: null, scope: ".", shallow: false },
  window: {
    since: "2025-06-01T12:00:00.000Z",
    until: "2026-06-01T12:00:00.000Z",
    commits: 40,
    realCommits: 40,
    couplingCommits: 38,
    lastCommitAt: null,
  },
  mechanicalCommits: {
    ignored: 0,
    renames: 0,
    whitespace: 0,
    reverts: 0,
    duplicates: 0,
  },
  logicalChanges: { by: "commit", count: 0, largest: 0 },
  comparison: null,
  thresholds: DEFAULT_THRESHOLDS,
  totals: { files: 3, contracts: 0, couplings: 0, modules: 0 },
  files: [
    fileRecord("a/x.ts", "t2", { rank: 1 }),
    fileRecord("b/y.ts", "t3", { rank: 2 }),
    fileRecord("c/z.ts", "t4", { rank: 3 }),
  ],
  contracts: [],
  ubiquitousFiles: [],
  couplings: [],
  modules: [],
  copyFamilies: [],
  ...NO_DESIGN_FINDINGS,
  territories: { recommended: 1, details: [], nodes: NODES },
  entryPoints: [boundary],
});

describe("inspect territories", () => {
  it("lists the territories of the matched files and the partners of their fit, in report order", () => {
    const result = inspect(reportOf(), ["a/x.ts"]);

    expect(result.territories.map(({ id }) => id)).toStrictEqual(["t2", "t3"]);
    expect(result.territories[0]?.fit?.containment).toBe(0.4);
  });

  it("lists no territory that no matched file lies in or reaches into", () => {
    expect(
      inspect(reportOf(), ["c/z.ts"]).territories.map(({ id }) => id),
    ).toStrictEqual(["t4"]);
    expect(inspect(reportOf(), ["nothing.ts"]).territories).toStrictEqual([]);
  });

  it("names the entry points of each matched file, and none for a file outside them", () => {
    const result = inspect(reportOf(), ["*/*.ts"]);

    expect(
      result.matches.map(({ path, entryPoints }) => [
        path,
        entryPoints.map(({ rank }) => rank),
      ]),
    ).toStrictEqual([
      ["a/x.ts", [1]],
      ["b/y.ts", []],
      ["c/z.ts", []],
    ]);
  });
});

describe("inspect territories of test code", () => {
  it("lists the territory that holds the tests territory of a matched file, which has no fit of its own", () => {
    const report = reportOf();
    const withTests: Report = {
      ...report,
      files: [...report.files, fileRecord("a/x.test.ts", "t5", { rank: 4 })],
      territories: {
        ...report.territories,
        nodes: [
          ...NODES,
          Object.assign(territoryRecord("t5", "tests", "t2"), { changes: 9 }),
        ],
      },
    };

    const result = inspect(withTests, ["a/x.test.ts"]);

    expect(result.territories.map(({ id }) => id)).toStrictEqual([
      "t2",
      "t3",
      "t5",
    ]);
  });

  it("lists the ancestors of a tests territory up to the nearest one with a fit", () => {
    const report = reportOf();
    const withTests: Report = {
      ...report,
      files: [...report.files, fileRecord("a/x.test.ts", "t6", { rank: 4 })],
      territories: {
        ...report.territories,
        nodes: [
          ...NODES,
          // t5 has no fit, so the walk goes on to t2, which has one
          Object.assign(territoryRecord("t5", "folder", "t2"), { changes: 9 }),
          Object.assign(territoryRecord("t6", "tests", "t5"), { changes: 9 }),
        ],
      },
    };

    expect(
      inspect(withTests, ["a/x.test.ts"]).territories.map(({ id }) => id),
    ).toStrictEqual(["t2", "t3", "t5", "t6"]);
  });
});
