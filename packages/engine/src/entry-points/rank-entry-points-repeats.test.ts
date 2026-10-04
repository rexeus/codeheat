import { describe, expect, it } from "vitest";

import { fileRecord } from "../testing/file-record.js";
import {
  CODE_FILES,
  COPY_FILES,
  copies,
  hidden,
  heated,
  rankInput as input,
  territories,
} from "../testing/rank-input.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { fitRecord } from "../testing/territory-record.js";
import { rankEntryPoints } from "./rank-entry-points.js";

/** An unstable interface at `path` that changed with `changedDependents` of its `fanIn` dependents. */
const hubAt = (path: string, fanIn = 20, changedDependents = 10) => ({
  path,
  module: "lib",
  fanIn,
  changes: 10,
  medianDependentChanges: 2,
  changedDependents,
  dependents: [],
  reason: "",
});

const CHRONIC = { kind: "chronic" as const, hotWindows: 5, windows: 6 };

const named = (kind: string, ranked: ReturnType<typeof rankEntryPoints>) =>
  ranked.filter((entry) => entry.kind === kind).map(({ files }) => files);

describe("rankEntryPoints of repeats", () => {
  it("leaves out an entry about files that one higher ranked entry names all of", () => {
    const ranked = rankEntryPoints(
      input({
        files: [...CODE_FILES, ...COPY_FILES],
        copyFamilies: [copies()],
        couplings: [hidden("a/x.ts", "b/x.ts")],
      }),
    );

    // the coupling of the two copies scores less than the copies, which name both
    expect(
      ranked.map(({ kind }) => kind).filter((kind) => kind !== "boundary"),
    ).toStrictEqual(["copies"]);
  });

  it("lists the next entry of the kind in the place of a repeat", () => {
    const ranked = rankEntryPoints(
      input({
        files: [
          ...CODE_FILES,
          ...COPY_FILES,
          heated("c/y.ts", "c", 10),
          heated("d/y.ts", "d", 10),
        ],
        copyFamilies: [copies()],
        couplings: [hidden("a/x.ts", "b/x.ts"), hidden("c/y.ts", "d/y.ts")],
        limits: { ...DEFAULT_THRESHOLDS, maxEntriesPerKind: 1 },
      }),
    );

    // the higher coupling repeats the copies, so the lower one is listed
    expect(named("coupling", ranked)).toStrictEqual([["c/y.ts", "d/y.ts"]]);
  });

  it("keeps an entry whose files two different entries name between them", () => {
    const ranked = rankEntryPoints(
      input({
        files: [
          ...CODE_FILES,
          heated("a/x.ts", "a", 10),
          heated("c/x.ts", "c", 100),
          heated("b/y.ts", "b", 100),
        ],
        copyFamilies: [{ ...copies(), files: ["a/x.ts", "c/x.ts"] }],
        unstableInterfaces: [hubAt("b/y.ts", 10, 10)],
        couplings: [hidden("a/x.ts", "b/y.ts")],
      }),
    );

    expect(named("copies", ranked)).toStrictEqual([["a/x.ts", "c/x.ts"]]);
    expect(named("hub", ranked)).toStrictEqual([["b/y.ts"]]);
    expect(named("coupling", ranked)).toStrictEqual([["a/x.ts", "b/y.ts"]]);
  });
});

describe("rankEntryPoints of repeats of a merged entry", () => {
  it("counts the files of a merged entry's hotspot finding as named by it", () => {
    const both = territories();
    const ranked = rankEntryPoints(
      input({
        territories: {
          ...both,
          nodes: both.nodes.map((node) =>
            node.id === "a"
              ? Object.assign({}, node, {
                  fit: fitRecord({ containment: 0.1, chronicShare: 0.6 }),
                })
              : node,
          ),
        },
        files: [
          ...CODE_FILES,
          fileRecord("a/hot.ts", "a", { heat: CHRONIC, score: 0.9 }),
        ],
        unstableInterfaces: [hubAt("a/hot.ts")],
      }),
    );

    // the entry of territory a is the boundary, and holds the hotspot as a finding
    expect(
      ranked.filter(({ territories: ids }) => ids[0] === "a"),
    ).toHaveLength(1);
    expect(named("hub", ranked)).toStrictEqual([]);
  });
});
