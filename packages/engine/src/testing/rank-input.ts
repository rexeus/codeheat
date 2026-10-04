import type { EntryPointInput } from "../entry-points/gather-candidates.js";
// Tests only: six territories with a thousand units of production heat each, and what to rank them with.
import type { CopyFamily } from "../report/copy-family.js";
import type { Coupling } from "../report/report.js";
import type { Territories } from "../report/territory.js";
import { NO_CROSSINGS } from "../territory-fit/crossing-pairs.js";
import { fileRecord } from "./file-record.js";
import { DEFAULT_THRESHOLDS } from "./report-defaults.js";
import { fitRecord, territoryRecord } from "./territory-record.js";

const IDS = ["a", "b", "c", "d", "e", "f"];

/** Six packages, `a` the leakiest and `f` the least; each reaches into the next and `f` into `a`, so no two are each other's partner. */
export const territories = (
  kinds: ReadonlyArray<"package" | "other"> = [],
): Territories => ({
  recommended: 1,
  details: [{ level: 1, ids: IDS }],
  nodes: [
    territoryRecord("r", "folder", null, IDS),
    ...IDS.map((id, index) =>
      Object.assign(territoryRecord(id, kinds[index] ?? "package", "r"), {
        heatShare: 0.1,
        changes: 40,
        fit: fitRecord({
          containment: 0.1 + index / 10,
          partner: {
            territory: IDS[(index + 1) % IDS.length] ?? "a",
            sharedChanges: 8,
            share: 0.2,
          },
        }),
      }),
    ),
  ],
});

/** A coupling of two files that no import links. */
export const hidden = (a: string, b: string): Coupling => ({
  a,
  b,
  sharedCommits: 8,
  degree: 0.5,
  distance: 2,
  testPair: false,
  kinds: { a: "code", b: "code" },
  crossesModule: true,
  imports: "none",
});

/** A file with `heat` units of heat and no other trait. */
export const heated = (path: string, territory: string, heat: number) =>
  fileRecord(path, territory, {
    changes: 1,
    loc: heat,
    complexity: { total: 0, mean: 0, max: 0 },
  });

/** Every territory holds 1000 of the 6000 units of the production code's heat. */
export const CODE_FILES = IDS.map((id) => heated(`${id}/main.ts`, id, 1000));

/** The two copies hold 30 more units each. */
export const COPY_FILES = [
  heated("a/x.ts", "a", 30),
  heated("b/x.ts", "b", 30),
];

export const copies = (): CopyFamily => ({
  files: ["a/x.ts", "b/x.ts"],
  similarity: { min: 0.8, max: 0.9 },
  testOnly: false,
  sharedChanges: 5,
  changesToAll: 5,
});

export const rankInput = (
  overrides: Partial<EntryPointInput> = {},
): EntryPointInput => ({
  territories: territories(),
  files: CODE_FILES,
  cliques: [],
  copyFamilies: [],
  couplings: [],
  unstableInterfaces: [],
  minChanges: 10,
  crossings: NO_CROSSINGS,
  limits: DEFAULT_THRESHOLDS,
  ...overrides,
});
