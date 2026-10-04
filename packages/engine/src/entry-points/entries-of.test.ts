import { describe, expect, it } from "vitest";

import type { Candidate } from "./candidate.js";
import { entriesOf } from "./entries-of.js";

const candidate = (
  kind: Candidate["kind"],
  score: number,
  territory: string,
  overrides: Partial<Candidate> = {},
): Candidate => ({
  kind,
  score,
  territories: [territory],
  files: [],
  evidence: { heatShare: 0.3 },
  verdict: `${kind} verdict`,
  designMove: `${kind} move`,
  ...overrides,
});

describe("entriesOf", () => {
  it("makes every candidate its own entry with itself as its one finding", () => {
    const [entry] = entriesOf([
      candidate("hub", 0.1, "t2", { files: ["a.ts"], evidence: { fanIn: 9 } }),
    ]);

    expect(entry?.findings).toStrictEqual([
      {
        kind: "hub",
        verdict: "hub verdict",
        designMove: "hub move",
        evidence: { fanIn: 9 },
        files: ["a.ts"],
      },
    ]);
    expect(entry?.files).toStrictEqual(["a.ts"]);
  });

  it("makes one entry of a territory's boundary and hotspot, led by the stronger", () => {
    const entries = entriesOf([
      candidate("boundary", 0.2, "t2", { evidence: { containment: 0.3 } }),
      candidate("hotspot", 0.1, "t2", {
        files: ["a/hot.ts"],
        evidence: { chronicFiles: 2 },
      }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "boundary",
      score: 0.2,
      territories: ["t2"],
      files: [],
      verdict: "boundary verdict",
      designMove: "boundary move",
      evidence: { containment: 0.3, chronicFiles: 2 },
    });
    expect(
      entries[0]?.findings.map(({ kind, files }) => [kind, files]),
    ).toStrictEqual([
      ["boundary", []],
      ["hotspot", ["a/hot.ts"]],
    ]);
  });

  it("leads with the hotspot when it scores higher, and with the boundary on a tie", () => {
    const hotter = entriesOf([
      candidate("boundary", 0.1, "t2"),
      candidate("hotspot", 0.2, "t2", { files: ["a/hot.ts"] }),
    ]);
    const tied = entriesOf([
      candidate("hotspot", 0.1, "t2", { files: ["a/hot.ts"] }),
      candidate("boundary", 0.1, "t2"),
    ]);

    expect(hotter.map(({ kind, score }) => [kind, score])).toStrictEqual([
      ["hotspot", 0.2],
    ]);
    expect(hotter[0]?.findings.map(({ kind }) => kind)).toStrictEqual([
      "hotspot",
      "boundary",
    ]);
    expect(tied.map(({ kind }) => kind)).toStrictEqual(["boundary"]);
  });
});

describe("entriesOf evidence", () => {
  it("lets the stronger finding's numbers win where a name repeats", () => {
    const [entry] = entriesOf([
      candidate("boundary", 0.2, "t2", { evidence: { heatShare: 0.5 } }),
      candidate("hotspot", 0.1, "t2", { evidence: { heatShare: 0.4 } }),
    ]);

    expect(entry?.evidence).toStrictEqual({ heatShare: 0.5 });
  });

  it("keeps the findings of different territories, and of other kinds, apart", () => {
    const entries = entriesOf([
      candidate("boundary", 0.2, "t2"),
      candidate("hotspot", 0.1, "t3", { files: ["b/hot.ts"] }),
      candidate("clique", 0.1, "t2"),
    ]);

    expect(
      entries.map(({ kind, findings }) => [kind, findings.length]),
    ).toStrictEqual([
      ["boundary", 1],
      ["hotspot", 1],
      ["clique", 1],
    ]);
  });
});
