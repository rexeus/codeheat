import { describe, expect, it } from "vitest";

import type { Entry } from "./candidate.js";
import { foldIntoCliques } from "./fold-into-cliques.js";

const entry = (
  kind: Entry["kind"],
  score: number,
  territories: ReadonlyArray<string>,
  overrides: Partial<Entry> = {},
): Entry => ({
  kind,
  score,
  territories,
  files: [],
  evidence: {},
  verdict: `${kind} ${territories.join("+")}`,
  designMove: `${kind} move`,
  findings: [
    {
      kind,
      verdict: `${kind} ${territories.join("+")}`,
      designMove: `${kind} move`,
      evidence: {},
      files: [],
      territories,
    },
  ],
  ...overrides,
});

const CLIQUE = entry("clique", 0.3, ["a", "b", "c"]);

describe("foldIntoCliques", () => {
  it("makes a boundary of a member of a higher ranked clique a finding of the clique", () => {
    const folded = foldIntoCliques([CLIQUE, entry("boundary", 0.2, ["b"])]);

    expect(
      folded.map(({ kind, territories }) => [kind, territories]),
    ).toStrictEqual([["clique", ["a", "b", "c"]]]);
    expect(
      folded[0]?.findings.map(({ kind, territories }) => [kind, territories]),
    ).toStrictEqual([
      ["clique", ["a", "b", "c"]],
      ["boundary", ["b"]],
    ]);
  });

  it("leaves everything else of the clique as it was", () => {
    const [folded] = foldIntoCliques([CLIQUE, entry("boundary", 0.2, ["b"])]);

    expect(folded).toMatchObject({
      kind: "clique",
      score: 0.3,
      territories: ["a", "b", "c"],
      files: [],
      verdict: CLIQUE.verdict,
      designMove: CLIQUE.designMove,
    });
  });

  it("keeps a boundary that ranks higher than the clique, or as high", () => {
    const entries = [
      entry("boundary", 0.4, ["a"]),
      CLIQUE,
      entry("boundary", 0.3, ["b"]),
    ];

    expect(foldIntoCliques(entries)).toStrictEqual(entries);
  });

  it("keeps a boundary of a territory that is no member", () => {
    const entries = [CLIQUE, entry("boundary", 0.2, ["d"])];

    expect(foldIntoCliques(entries)).toStrictEqual(entries);
  });
});

describe("foldIntoCliques of a boundary between two territories", () => {
  it("takes in a boundary between two territories when both are members, with the findings it is made of", () => {
    const between = entry("boundary", 0.2, ["a", "c"], {
      findings: [
        ...entry("boundary", 0.2, ["a", "c"]).findings,
        ...entry("boundary", 0.1, ["a"]).findings,
        ...entry("boundary", 0.1, ["c"]).findings,
      ],
    });

    const [folded] = foldIntoCliques([CLIQUE, between]);

    expect(foldIntoCliques([CLIQUE, between])).toHaveLength(1);
    expect(
      folded?.findings.map(({ territories }) => territories),
    ).toStrictEqual([["a", "b", "c"], ["a", "c"], ["a"], ["c"]]);
  });

  it("keeps a boundary between a member and a territory outside the clique", () => {
    const entries = [CLIQUE, entry("boundary", 0.2, ["a", "d"])];

    expect(foldIntoCliques(entries)).toStrictEqual(entries);
  });
});

describe("foldIntoCliques of several cliques and kinds", () => {
  it("takes in the boundary into the best clique that explains it, and one boundary only once", () => {
    const better = entry("clique", 0.5, ["b", "e", "f"]);
    const folded = foldIntoCliques([
      CLIQUE,
      better,
      entry("boundary", 0.2, ["b"]),
    ]);

    expect(folded.map(({ findings }) => findings.length)).toStrictEqual([1, 2]);
    expect(folded[1]?.territories).toStrictEqual(["b", "e", "f"]);
  });

  it("does not take in a hotspot that is the primary finding of its entry, nor other kinds", () => {
    const entries = [
      CLIQUE,
      entry("hotspot", 0.2, ["b"], { files: ["b/hot.ts"] }),
      entry("hub", 0.1, ["b"], { files: ["b/x.ts"] }),
    ];

    expect(foldIntoCliques(entries)).toStrictEqual(entries);
  });
});
