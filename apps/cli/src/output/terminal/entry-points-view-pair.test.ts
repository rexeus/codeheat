import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { entryPointLines, fileEntryPointLines } from "./entry-points-view.js";
import { makeStyle } from "./style.js";

type EntryPoint = Report["entryPoints"][number];

const finding = (
  verdict: string,
  designMove: string,
  territories: ReadonlyArray<string>,
  evidence: Readonly<Record<string, number>>,
): EntryPoint["findings"][number] => ({
  kind: "boundary",
  verdict,
  designMove,
  evidence,
  files: [],
  territories,
});

const BETWEEN = finding(
  "The boundary between billing and web does not hold.",
  "Move.",
  ["t2", "t3"],
  { codeHeatShare: 0.4, containment: 0.43, changes: 48, sharedChanges: 12 },
);

/** The boundary between `billing` and `web`, with the boundary of each as a finding. */
const between: EntryPoint = {
  rank: 1,
  kind: "boundary",
  score: 0.3,
  territories: ["t2", "t3"],
  files: [],
  evidence: BETWEEN.evidence,
  verdict: BETWEEN.verdict,
  designMove: BETWEEN.designMove,
  findings: [
    BETWEEN,
    finding("Leaks.", "Move billing.", ["t2"], {
      codeHeatShare: 0.3,
      containment: 0.4,
      changes: 40,
    }),
    finding("Leaks too.", "Move web.", ["t3"], {}),
  ],
};

const lines = (): ReadonlyArray<string> =>
  entryPointLines(
    {
      entryPoints: [between],
      territories: {
        recommended: 1,
        details: [],
        nodes: Object.entries({ t2: "billing", t3: "web" }).map(
          ([id, path]) => ({
            id,
            path,
            kind: "folder" as const,
            parent: null,
            children: [],
            files: 1,
            testFiles: 0,
            changes: 1,
            heatShare: 0,
            description: path,
            splitReason: null,
            fit: null,
          }),
        ),
      },
    },
    makeStyle(false),
  );

describe("entryPointLines of a boundary between two territories", () => {
  it("counts the changes of both and those that touched both", () => {
    expect(lines().slice(1, 5)).toStrictEqual([
      "1. boundary  billing, web",
      "   The boundary between billing and web does not hold.",
      "   40% of the code's heat; 43% of their 48 changes stay inside, 12 changes touched both",
      "   Move.",
    ]);
  });

  it("says which territory each further finding is about", () => {
    expect(lines().slice(5, 11)).toStrictEqual([
      "   Also boundary of billing: Leaks.",
      "   30% of the code's heat; 40% of its 40 changes stay inside",
      "   Move billing.",
      "   Also boundary of web: Leaks too.",
      "   0% of the code's heat; 0% of its 0 changes stay inside",
      "   Move web.",
    ]);
  });
});

describe("fileEntryPointLines of a boundary between two territories", () => {
  it("tells the boundary between both once, not once more for each territory", () => {
    expect(fileEntryPointLines([between])).toStrictEqual([
      "entry point #1 (boundary): The boundary between billing and web does not hold.",
      "  Move.",
    ]);
  });
});
