import { describe, expect, it } from "vitest";

import type { History, HistoryCommit } from "../history/history.js";
import { familiesOf } from "./families.js";

const PATHS = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"];

/** A commit that touched the files with these ids; `size` defaults to how many they are. */
const commit = (
  ids: ReadonlyArray<number>,
  size = ids.length,
): HistoryCommit => ({ files: Uint32Array.from(ids), size });

const historyOf = (...commits: ReadonlyArray<HistoryCommit>): History => ({
  paths: PATHS,
  files: new Map(),
  commits,
});

describe("familiesOf membership", () => {
  it("is empty without similar pairs", () => {
    expect(familiesOf([], historyOf(commit([0, 1])))).toEqual([]);
  });

  it("joins a chain of similar pairs into one family with its sorted members", () => {
    const families = familiesOf(
      [
        { a: "c.ts", b: "b.ts", similarity: 0.8 },
        { a: "a.ts", b: "b.ts", similarity: 0.6 },
      ],
      historyOf(commit([0, 1, 2])),
    );

    expect(families.map(({ files }) => files)).toEqual([
      ["a.ts", "b.ts", "c.ts"],
    ]);
  });

  it("keeps unconnected pairs as separate families", () => {
    const families = familiesOf(
      [
        { a: "a.ts", b: "b.ts", similarity: 0.7 },
        { a: "d.ts", b: "e.ts", similarity: 0.9 },
      ],
      historyOf(),
    );

    expect(families.map(({ files }) => files)).toEqual([
      ["a.ts", "b.ts"],
      ["d.ts", "e.ts"],
    ]);
  });

  it("reports the weakest and strongest similarity among the pairs of a family, rounded", () => {
    const [family] = familiesOf(
      [
        { a: "a.ts", b: "b.ts", similarity: 0.512_349 },
        { a: "b.ts", b: "c.ts", similarity: 0.9 },
        { a: "a.ts", b: "c.ts", similarity: 0.7 },
      ],
      historyOf(),
    );

    expect(family?.similarity).toEqual({ min: 0.5123, max: 0.9 });
  });
});

describe("familiesOf changes", () => {
  const pairs = [
    { a: "a.ts", b: "b.ts", similarity: 0.7 },
    { a: "b.ts", b: "c.ts", similarity: 0.7 },
  ];

  it("counts the commits that touched two members and the commits that touched all of them", () => {
    const [family] = familiesOf(
      pairs,
      historyOf(
        commit([0, 1, 2]),
        commit([0, 1, 2, 5]),
        commit([1, 2]),
        commit([0]),
        commit([0, 3]),
      ),
    );

    expect(family).toMatchObject({ sharedChanges: 3, changesToAll: 2 });
  });

  it("ignores commits above maxCommitFiles", () => {
    const [family] = familiesOf(
      [{ a: "a.ts", b: "b.ts", similarity: 0.7 }],
      historyOf(commit([0, 1]), commit([0, 1], 51)),
    );

    expect(family).toMatchObject({ sharedChanges: 1, changesToAll: 1 });
  });

  it("ranks the family with more fixes applied to all members first", () => {
    const families = familiesOf(
      [
        { a: "a.ts", b: "b.ts", similarity: 0.9 },
        { a: "d.ts", b: "e.ts", similarity: 0.6 },
      ],
      historyOf(commit([0, 1]), commit([3, 4]), commit([3, 4]), commit([3, 4])),
    );

    expect(families.map(({ files }) => files[0])).toEqual(["d.ts", "a.ts"]);
  });
});
