import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { coupling } from "../testing/reports.js";
import { expansionAt } from "../testing/territory-cards.js";
import { territoryTreeReport } from "../testing/territory-tree.js";

const report = territoryTreeReport();
const partnersOf = (reported: Report, level: number, id: string) =>
  expansionAt(reported, level, id).partners;

describe("the territories a territory changes together with", () => {
  it("lists those it shares coupled file pairs with, most pairs first", () => {
    expect(partnersOf(report, 2, "t3")).toEqual([
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

  it("does not count the pair of a file and its test", () => {
    const names = partnersOf(report, 2, "t3").map(({ name }) => name);

    expect(names).not.toContain("core/src");
  });

  it("does not count a pair with a spec file that crosses the edge", () => {
    // a.test.ts changed with docs/d.md in 20 changes; only a.ts's 4 count.
    const docs = partnersOf(report, 2, "t3").find(
      ({ name }) => name === "docs",
    );

    expect(docs).toMatchObject({
      pairs: 1,
      strongest: { sharedChanges: 4 },
    });
  });

  it("does not count a pair of two contract files", () => {
    const withContracts: Report = {
      ...report,
      couplings: [
        coupling("core/src/a.ts", "docs/d.md", {
          sharedCommits: 30,
          kinds: { a: "contract", b: "contract" },
        }),
      ],
    };

    expect(partnersOf(withContracts, 2, "t3")).toEqual([]);
  });

  it("lists no partners for test code, and no test territory as a partner", () => {
    const toTests: Report = {
      ...report,
      couplings: [
        coupling("core/src/a.ts", "core/c.test.ts"),
        coupling("core/c.test.ts", "docs/d.md"),
      ],
    };

    expect(partnersOf(toTests, 2, "t3")).toEqual([]);
    expect(partnersOf(toTests, 2, "t6")).toEqual([]);
  });
});
