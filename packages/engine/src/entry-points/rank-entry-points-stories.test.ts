import { describe, expect, it } from "vitest";

import { rankInput as input, territories } from "../testing/rank-input.js";
import { rankEntryPoints } from "./rank-entry-points.js";

const reach = (territory: string) => ({
  territory,
  sharedChanges: 8,
  share: 0.2,
});

/** `a` and `b` leak into each other; every other territory leaks into the next one (see `territories`). */
const mirrored = () => {
  const base = territories();
  return {
    ...base,
    nodes: base.nodes.map((node) =>
      node.id === "a" || node.id === "b"
        ? Object.assign({}, node, {
            fit: node.fit && {
              ...node.fit,
              partner: reach(node.id === "a" ? "b" : "a"),
            },
          })
        : node,
    ),
  };
};

const unit = (weakestShare: number) => ({
  modules: ["a", "b", "c"],
  sharedCommits: 10,
  weakestShare,
  reason: "",
});

const summary = (entries: ReturnType<typeof rankEntryPoints>) =>
  entries.map(({ kind, territories: ids, findings }) => [
    kind,
    ids,
    findings.map(({ territories: of }) => of.join("+")),
  ]);

describe("rankEntryPoints tells one story once", () => {
  it("lists two territories that leak into each other as one entry, scored as both", () => {
    const ranked = rankEntryPoints(input({ territories: mirrored() }));

    // a: ⅙ × 0.9 = 0.15, b: ⅙ × 0.8 = 0.1333; c to f reach into the next one
    expect(
      ranked.map(({ kind, territories: ids, score }) => [kind, ids, score]),
    ).toStrictEqual([
      ["boundary", ["a", "b"], 0.2833],
      ["boundary", ["c"], 0.1167],
      ["boundary", ["d"], 0.1],
      ["boundary", ["e"], 0.0833],
      ["boundary", ["f"], 0.0667],
    ]);
    expect(summary(ranked)[0]).toStrictEqual([
      "boundary",
      ["a", "b"],
      ["a+b", "a", "b"],
    ]);
  });

  it("makes the boundaries of the members of a higher ranked clique findings of the clique", () => {
    const ranked = rankEntryPoints(
      input({ territories: mirrored(), cliques: [unit(0.8)] }),
    );

    // the clique: ½ of the heat × 0.8 = 0.4, above the pair (0.2833) and c (0.1167)
    expect(summary(ranked).slice(0, 2)).toStrictEqual([
      ["clique", ["a", "b", "c"], ["a+b+c", "a+b", "a", "b", "c"]],
      ["boundary", ["d"], ["d"]],
    ]);
  });

  it("keeps the boundary that outranks the clique, and folds in what the clique outranks", () => {
    const ranked = rankEntryPoints(
      input({ territories: mirrored(), cliques: [unit(0.3)] }),
    );

    // the clique scores ½ × 0.3 = 0.15: below the pair, above c
    expect(summary(ranked).slice(0, 3)).toStrictEqual([
      ["boundary", ["a", "b"], ["a+b", "a", "b"]],
      ["clique", ["a", "b", "c"], ["a+b+c", "c"]],
      ["boundary", ["d"], ["d"]],
    ]);
  });
});
