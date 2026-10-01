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
        crossesModule: false,
        imports: null,
        hidden: false,
      },
    ]);
  });

  it("marks a partner without an import as hidden, but never a test pair", () => {
    const marked = indexPartners([
      coupling("src/a.ts", "src/b.ts", { imports: "none" }),
      coupling("src/c.ts", "src/c.test.ts", {
        imports: "none",
        testPair: true,
      }),
    ]);

    expect(marked.get("src/a.ts")?.[0]?.hidden).toBe(true);
    expect(marked.get("src/b.ts")?.[0]?.hidden).toBe(true);
    expect(marked.get("src/c.ts")?.[0]?.hidden).toBe(false);
  });

  it("reads the import direction from the side of the file the partners belong to", () => {
    const imported = indexPartners([
      coupling("src/a.ts", "src/b.ts", { imports: "a→b" }),
      coupling("src/c.ts", "src/d.ts", { imports: "none" }),
    ]);

    expect(imported.get("src/a.ts")?.[0]?.imports).toBe("file→partner");
    expect(imported.get("src/b.ts")?.[0]?.imports).toBe("partner→file");
    expect(imported.get("src/c.ts")?.[0]?.imports).toBe("none");
    expect(imported.get("src/d.ts")?.[0]?.imports).toBe("none");
  });

  it("has no entry for a file without couplings", () => {
    expect(index.has("src/other.ts")).toBe(false);
  });
});
