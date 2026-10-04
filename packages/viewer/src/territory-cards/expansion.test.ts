import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { territoryTreeReport } from "../testing/territory-tree.js";
import { cardSourceOf, cardsOf } from "./card-model.js";
import { expansionOf } from "./expansion.js";
import { indexLevel } from "./level-index.js";

const expansionAt = (report: Report, level: number, id: string) => {
  const source = cardSourceOf(report, indexTerritories(report.territories), []);
  const index = indexLevel(report.territories, report.files, level);
  const cards = cardsOf(source, index);
  const card = cards.find(({ territory }) => territory.id === id);
  if (card === undefined) {
    throw new Error(`no card ${id} at detail ${level}`);
  }
  return expansionOf(card, cards, index, source);
};

const report = territoryTreeReport();

describe("the stats of an expanded card", () => {
  const stats = expansionAt(report, 2, "t3").stats;
  const row = (label: string) => stats.find((stat) => stat.label === label);

  it("sets the share of the effort against the share of the files", () => {
    expect(row("Share of the change effort")).toMatchObject({
      value: "40%",
      reference: "its share of the files: 20%",
      meter: { value: 0.4, reference: 0.2 },
    });
  });

  it("counts the changes that touch it against the whole window", () => {
    expect(row("Counted changes touching it")).toMatchObject({
      value: "30",
      reference: "30% of 100 in the window",
    });
  });

  it("sets what stays inside against the median territory of the detail", () => {
    expect(row("Changes that stay inside")).toMatchObject({
      value: "30%",
      reference: "the median territory here: 80%",
    });
  });

  it("says what the territory's own fit adds", () => {
    expect(row("Hot files")).toMatchObject({
      value: "1 chronic · 0 acute",
      reference: "of 2 files",
    });
    expect(row("Territories a change here touches")?.value).toBe("2");
    expect(row("File pairs across its edge")).toMatchObject({
      value: "3",
      reference: "2 with no import between them",
    });
  });

  it("leaves out the fixes when commit subjects do not tell", () => {
    expect(row("Changes that are fixes")).toBeUndefined();
  });

  it("says a territory is not judged and why, without a meter", () => {
    const tests = expansionAt(report, 2, "t6").stats.find(
      (stat) => stat.label === "Changes that stay inside",
    );

    expect(tests).toMatchObject({
      value: "not judged",
      reference: "test code is not judged",
      meter: null,
    });
  });
});

describe("the rest of an expanded card", () => {
  it("lists the hottest files of the code, with how long they have been hot", () => {
    const { hotFiles } = expansionAt(report, 2, "t3");

    expect(hotFiles.map(({ file }) => file.path)).toEqual(["core/src/a.ts"]);
    expect(hotFiles[0]?.heat).toBeNull();
  });

  it("lists the territories it shares coupled file pairs with, most pairs first", () => {
    const { partners } = expansionAt(report, 2, "t3");

    expect(partners).toEqual([
      {
        name: "core/rest",
        pairs: 1,
        hiddenPairs: 1,
        strongest: {
          a: "core/src/a.ts",
          b: "core/rest/b.ts",
          sharedChanges: 7,
        },
      },
      {
        name: "docs",
        pairs: 1,
        hiddenPairs: 0,
        strongest: { a: "core/src/a.ts", b: "docs/d.md", sharedChanges: 4 },
      },
    ]);
  });

  it("does not count the pair of a file and its test as coupling", () => {
    const { partners } = expansionAt(report, 2, "t3");

    expect(partners.map(({ name }) => name)).not.toContain("core/src");
  });

  it("lists the territories inside it and why it splits", () => {
    const { inner, splitReason } = expansionAt(report, 1, "t2");

    expect(splitReason).toBe("src and rest change independently");
    expect(inner).toEqual([
      { name: "core/src", heatShare: 0.4, containment: 0.3 },
      { name: "core/rest", heatShare: 0.2, containment: 0.8 },
    ]);
  });

  it("has nothing inside a territory that does not split", () => {
    const { inner, splitReason } = expansionAt(report, 2, "t3");

    expect(inner).toEqual([]);
    expect(splitReason).toBeNull();
  });

  it("says when the containment is measured against another detail than the one shown", () => {
    expect(expansionAt(report, 1, "t5").detailNote).toBeNull();
    expect(expansionAt(report, 2, "t5").detailNote).toContain("detail 1");
  });
});
