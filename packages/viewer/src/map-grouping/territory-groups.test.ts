import { describe, expect, it } from "vitest";

import { fileStats, territoryNode } from "../testing/reports.js";
import { detailChoices, groupFilesAt, visibleAt } from "./territory-groups.js";

const territories = {
  recommended: 2,
  details: [
    { level: 1, ids: ["t2", "t3"] },
    { level: 2, ids: ["t4", "t5", "t3", "t6", "t7"] },
  ],
  nodes: [
    territoryNode("t1", ".", { children: ["t2", "t3"], fit: null }),
    territoryNode("t2", "core", { parent: "t1", children: ["t4", "t5"] }),
    territoryNode("t3", "web", { parent: "t1" }),
    territoryNode("t4", "core/src", { parent: "t2" }),
    territoryNode("t5", "core/lib", { parent: "t2" }),
    territoryNode("t6", "2 smaller folders", { parent: "t2", kind: "other" }),
    territoryNode("t7", "3 smaller folders", { parent: "t1", kind: "other" }),
  ],
};

describe("groupFilesAt", () => {
  const files = [
    fileStats("web/a.ts", { territory: "t3" }),
    fileStats("core/src/b.ts", { territory: "t4" }),
    fileStats("core/lib/c.ts", { territory: "t5" }),
    fileStats("core/lib/d.ts", { territory: "t5" }),
  ];

  it("climbs from the finest territory of a file to the one a detail shows", () => {
    const groups = groupFilesAt(territories, files, 1);

    expect(
      groups.map(({ territory, files: own }) => [
        territory.id,
        own.map(({ path }) => path),
      ]),
    ).toStrictEqual([
      ["t2", ["core/src/b.ts", "core/lib/c.ts", "core/lib/d.ts"]],
      ["t3", ["web/a.ts"]],
    ]);
  });

  it("keeps the order of the detail and leaves out a territory without a listed file", () => {
    expect(
      groupFilesAt(territories, files, 2).map(({ territory }) => territory.id),
    ).toStrictEqual(["t4", "t5", "t3"]);
  });

  it("finds nothing at a detail the report does not have", () => {
    expect(groupFilesAt(territories, files, 9)).toStrictEqual([]);
    expect(visibleAt(territories, 9).size).toBe(0);
  });
});

describe("detailChoices", () => {
  it("counts the real territories of each detail and marks the recommended one", () => {
    expect(detailChoices(territories)).toStrictEqual([
      { level: 1, territories: 2, recommended: false },
      { level: 2, territories: 3, recommended: true },
    ]);
  });
});
