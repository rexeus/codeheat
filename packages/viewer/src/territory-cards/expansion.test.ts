import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { expansionAt } from "../testing/territory-cards.js";
import { territoryTreeReport } from "../testing/territory-tree.js";

const report = territoryTreeReport();

const row = (label: string) =>
  expansionAt(report, 2, "t3").stats.find((stat) => stat.label === label);

describe("the stats of an expanded card", () => {
  it("sets the share of the effort against the share of the files", () => {
    expect(row("Share of the change effort")).toMatchObject({
      value: "40%",
      reference: "its share of the files: 20%",
      meter: { value: 0.4, reference: 0.2 },
    });
  });

  it("counts the changes that touch it against the changes that count, not the logical changes before the size limit", () => {
    // 30 of the 120 counted changes (`window.couplingCommits`) is 25%; of the
    // 500 logical changes it would be 6%.
    expect(row("Counted changes touching it")).toMatchObject({
      value: "30",
      reference: "25% of 120 in the window",
      meter: { value: 0.25, reference: null },
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
});

describe("the containment of an expanded card", () => {
  it("sets what stays inside against the median of the territories measured at the detail shown", () => {
    // t3, t4 and t5 are measured at detail 2 with 30%, 80% and 90%.
    expect(row("Changes that stay inside")).toMatchObject({
      value: "30%",
      reference: "the median of the territories measured at detail 2: 80%",
    });
  });

  it("leaves out the territories measured at another detail from that median", () => {
    // At detail 1 only t2 (60%) is measured at detail 1; t5 is measured at 2.
    const stat = expansionAt(report, 1, "t2").stats.find(
      ({ label }) => label === "Changes that stay inside",
    );

    expect(stat?.reference).toBe(
      "the median of the territories measured at detail 1: 60%",
    );
  });

  it("says so when no territory at the detail shown is measured at it", () => {
    const base = territoryTreeReport();
    const finer: Report = {
      ...base,
      territories: {
        ...base.territories,
        nodes: base.territories.nodes.map((node) =>
          node.fit === null
            ? node
            : Object.assign({}, node, {
                fit: Object.assign({}, node.fit, { detail: 1 }),
              }),
        ),
      },
    };

    const stat = expansionAt(finer, 2, "t3").stats.find(
      ({ label }) => label === "Changes that stay inside",
    );

    expect(stat).toMatchObject({
      reference: "no territory is measured at detail 2 to compare with",
      meter: { value: 0.3, reference: null },
    });
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
    expect(expansionAt(report, 2, "t5").detailNote).toBeNull();
    expect(expansionAt(report, 1, "t5").detailNote).toContain("detail 2");
  });
});
