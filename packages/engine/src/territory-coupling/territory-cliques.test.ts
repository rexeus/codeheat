import { describe, expect, it } from "vitest";

import type { Clique } from "../model/clique.js";
import { territoryRecord } from "../testing/territory-record.js";
import { territoryCliques } from "./territory-cliques.js";

const territory = (id: string, heatShare: number) => ({
  ...territoryRecord(id, "package", "r"),
  heatShare,
});

const byId = new Map(
  [
    territory("a", 0.3),
    territory("b", 0.2),
    territory("c", 0.1),
    territory("d", 0.05),
  ].map((node) => [node.id, node]),
);

const clique = (
  modules: ReadonlyArray<string>,
  sharedCommits: number,
  weakestShare: number,
): Clique => ({ modules, sharedCommits, weakestShare, reason: "" });

describe("territoryCliques", () => {
  it("names the member territories and the evidence an entry point of kind clique is scored on", () => {
    expect(
      territoryCliques(
        [clique(["a", "b", "c"], 12, 0.5), clique(["b", "c", "d"], 4, 0.3)],
        byId,
      ),
    ).toStrictEqual([
      {
        territories: ["a", "b", "c"],
        sharedChanges: 12,
        weakestShare: 0.5,
        heatShare: 0.6,
      },
      {
        territories: ["b", "c", "d"],
        sharedChanges: 4,
        weakestShare: 0.3,
        heatShare: 0.35,
      },
    ]);
  });

  it("lists nothing without cliques", () => {
    expect(territoryCliques([], byId)).toStrictEqual([]);
  });
});
