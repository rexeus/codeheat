import { describe, expect, it } from "vitest";

import type { Entry } from "./candidate.js";
import { foldBoundariesAndCliques } from "./fold-boundaries-and-cliques.js";

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

describe("foldBoundariesAndCliques", () => {
  it("makes a boundary of a member of a higher ranked clique a finding of the clique", () => {
    const folded = foldBoundariesAndCliques([
      CLIQUE,
      entry("boundary", 0.2, ["b"]),
    ]);

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
    const [folded] = foldBoundariesAndCliques([
      CLIQUE,
      entry("boundary", 0.2, ["b"]),
    ]);

    expect(folded).toMatchObject({
      kind: "clique",
      score: 0.3,
      territories: ["a", "b", "c"],
      files: [],
      verdict: CLIQUE.verdict,
      designMove: CLIQUE.designMove,
    });
  });

  it("keeps a boundary that is no member of the clique, whatever it scores", () => {
    const entries = [entry("boundary", 0.4, ["d"]), CLIQUE];

    expect(foldBoundariesAndCliques(entries)).toStrictEqual(entries);
  });

  it("keeps a boundary of a territory that is no member", () => {
    const entries = [CLIQUE, entry("boundary", 0.2, ["d"])];

    expect(foldBoundariesAndCliques(entries)).toStrictEqual(entries);
  });
});

describe("foldBoundariesAndCliques of a boundary between two territories", () => {
  it("takes in a boundary between two territories when both are members, with the findings it is made of", () => {
    const between = entry("boundary", 0.2, ["a", "c"], {
      findings: [
        ...entry("boundary", 0.2, ["a", "c"]).findings,
        ...entry("boundary", 0.1, ["a"]).findings,
        ...entry("boundary", 0.1, ["c"]).findings,
      ],
    });

    const [folded] = foldBoundariesAndCliques([CLIQUE, between]);

    expect(foldBoundariesAndCliques([CLIQUE, between])).toHaveLength(1);
    expect(
      folded?.findings.map(({ territories }) => territories),
    ).toStrictEqual([["a", "b", "c"], ["a", "c"], ["a"], ["c"]]);
  });

  it("keeps a boundary between a member and a territory outside the clique", () => {
    const entries = [CLIQUE, entry("boundary", 0.2, ["a", "d"])];

    expect(foldBoundariesAndCliques(entries)).toStrictEqual(entries);
  });
});

describe("foldBoundariesAndCliques of a clique that a boundary outranks", () => {
  const between = entry("boundary", 0.4, ["a", "b"], {
    findings: [
      ...entry("boundary", 0.4, ["a", "b"]).findings,
      ...entry("boundary", 0.2, ["a"]).findings,
      ...entry("boundary", 0.2, ["b"]).findings,
    ],
  });

  it("makes the clique a finding of the boundary between two of its members", () => {
    const folded = foldBoundariesAndCliques([between, CLIQUE]);

    expect(folded).toHaveLength(1);
    expect(folded[0]).toMatchObject({
      kind: "boundary",
      score: 0.4,
      territories: ["a", "b"],
    });
    expect(
      folded[0]?.findings.map(({ kind, territories }) => [kind, territories]),
    ).toStrictEqual([
      ["boundary", ["a", "b"]],
      ["boundary", ["a"]],
      ["boundary", ["b"]],
      ["clique", ["a", "b", "c"]],
    ]);
  });

  it("lets the boundary lead on a tie", () => {
    const tied = entry("boundary", 0.3, ["a", "b"]);

    expect(
      foldBoundariesAndCliques([CLIQUE, tied]).map(({ kind }) => kind),
    ).toStrictEqual(["boundary"]);
  });

  it("keeps a clique that has only some of the boundary's territories as members", () => {
    const entries = [entry("boundary", 0.4, ["a", "d"]), CLIQUE];

    expect(foldBoundariesAndCliques(entries)).toStrictEqual(entries);
  });

  it("takes in every clique it explains", () => {
    const other = entry("clique", 0.1, ["a", "b", "x"]);

    const folded = foldBoundariesAndCliques([between, CLIQUE, other]);

    expect(folded).toHaveLength(1);
    expect(
      folded[0]?.findings.map(({ territories }) => territories.join("+")),
    ).toStrictEqual(["a+b", "a", "b", "a+b+c", "a+b+x"]);
  });

  it("takes in nothing once it is taken in itself", () => {
    const higher = entry("clique", 0.9, ["a", "b", "y"]);

    const folded = foldBoundariesAndCliques([between, CLIQUE, higher]);

    // the clique at 0.9 takes in the boundary, which can no longer take in the one at 0.3
    expect(folded.map(({ kind, score }) => [kind, score])).toStrictEqual([
      ["clique", 0.3],
      ["clique", 0.9],
    ]);
  });
});

describe("foldBoundariesAndCliques never hides a larger story behind a boundary", () => {
  const between = entry("boundary", 0.4, ["a", "b"]);

  it("takes in a clique of three members, the two and one more", () => {
    expect(
      foldBoundariesAndCliques([
        between,
        entry("clique", 0.3, ["a", "b", "c"]),
      ]),
    ).toHaveLength(1);
  });

  it("keeps a clique of four members, which has more than one territory beyond the pair", () => {
    const entries = [between, entry("clique", 0.3, ["a", "b", "c", "d"])];

    expect(foldBoundariesAndCliques(entries)).toStrictEqual(entries);
  });

  it("keeps a clique that a boundary of one territory outranks, however small", () => {
    const entries = [
      entry("boundary", 0.4, ["a"]),
      entry("clique", 0.3, ["a", "b", "c"]),
    ];

    expect(foldBoundariesAndCliques(entries)).toStrictEqual(entries);
  });

  it("still lets a higher ranked clique of any size take in a single boundary or a pair", () => {
    const big = entry("clique", 0.9, ["a", "b", "c", "d", "e"]);

    const folded = foldBoundariesAndCliques([
      big,
      entry("boundary", 0.4, ["a"]),
      between,
    ]);

    expect(folded).toHaveLength(1);
    expect(folded[0]?.findings).toHaveLength(3);
  });
});

describe("foldBoundariesAndCliques of several cliques and kinds", () => {
  it("takes in the boundary into the best clique that explains it, and one boundary only once", () => {
    const better = entry("clique", 0.5, ["b", "e", "f"]);
    const folded = foldBoundariesAndCliques([
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

    expect(foldBoundariesAndCliques(entries)).toStrictEqual(entries);
  });
});
