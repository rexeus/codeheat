import { describe, expect, it } from "vitest";

import { coupling } from "../testing/reports.js";
import { indexPartners } from "./partners.js";

const couplings = [
  coupling("src/tax.ts", "src/tax.test.ts", {
    degree: 0.9,
    testPair: true,
    sharedCommits: 20,
  }),
  coupling("src/tax.ts", "web/checkout.ts", {
    degree: 0.4,
    distance: 3,
    sharedCommits: 6,
  }),
  coupling("web/cart.ts", "src/tax.ts", {
    degree: 0.6,
    distance: 3,
    sharedCommits: 9,
  }),
];
const index = indexPartners(couplings);

describe("indexPartners", () => {
  it("lists a file's partners from both sides of its couplings, strongest first", () => {
    expect(
      index.get("src/tax.ts")?.map(({ path, degree }) => [path, degree]),
    ).toEqual([
      ["src/tax.test.ts", 0.9],
      ["web/cart.ts", 0.6],
      ["web/checkout.ts", 0.4],
    ]);
  });

  it("carries the measures of the coupling to each partner", () => {
    expect(index.get("src/tax.test.ts")).toEqual([
      {
        path: "src/tax.ts",
        degree: 0.9,
        testPair: true,
        sharedCommits: 20,
        distance: 0,
      },
    ]);
  });

  it("has no entry for a file without couplings", () => {
    expect(index.has("src/other.ts")).toBe(false);
  });
});
