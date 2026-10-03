import { describe, expect, it } from "vitest";

import type { History, HistoryCommit } from "../history/history.js";
import { countKinds } from "../mechanical/kinds.js";
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
  mechanical: countKinds([]),
});

/** The similarity of every pair named as `"a.ts b.ts"`, in either order; 0 for any other. */
const similarities =
  (table: Readonly<Record<string, number>>) =>
  (a: string, b: string): number =>
    table[`${a} ${b}`] ?? table[`${b} ${a}`] ?? 0;

/** The pairs of `table` as links, the way the finder links files that are alike enough. */
const linksOf = (
  table: Readonly<Record<string, number>>,
): ReadonlyArray<{ a: string; b: string }> =>
  Object.keys(table).map((key) => {
    const [a = "", b = ""] = key.split(" ");
    return { a, b };
  });

const familiesFor = (
  table: Readonly<Record<string, number>>,
  history: History = historyOf(),
) => familiesOf(linksOf(table), history, similarities(table));

describe("familiesOf membership", () => {
  it("is empty without links", () => {
    expect(familiesOf([], historyOf(commit([0, 1])), () => 0)).toEqual([]);
  });

  it("joins a chain of links into one family with its sorted members", () => {
    const families = familiesFor(
      { "c.ts b.ts": 0.8, "a.ts b.ts": 0.6 },
      historyOf(commit([0, 1, 2])),
    );

    expect(families.map(({ files }) => files)).toEqual([
      ["a.ts", "b.ts", "c.ts"],
    ]);
  });

  it("keeps unconnected pairs as separate families", () => {
    const families = familiesFor({ "a.ts b.ts": 0.7, "d.ts e.ts": 0.9 });

    expect(families.map(({ files }) => files)).toEqual([
      ["a.ts", "b.ts"],
      ["d.ts", "e.ts"],
    ]);
  });
});

describe("familiesOf similarity", () => {
  it("reports the weakest and strongest similarity among the pairs of a family, rounded", () => {
    const [family] = familiesFor({
      "a.ts b.ts": 0.512_349,
      "b.ts c.ts": 0.9,
      "a.ts c.ts": 0.7,
    });

    expect(family?.similarity).toEqual({ min: 0.5123, max: 0.9 });
  });

  it("measures every pair of members, so a chain's ends that share little pull the minimum down", () => {
    // a is like b and b like c, which links all three; a and c are alike by 0.1 only
    const [family] = familiesOf(
      [
        { a: "a.ts", b: "b.ts" },
        { a: "b.ts", b: "c.ts" },
      ],
      historyOf(),
      similarities({ "a.ts b.ts": 0.6, "b.ts c.ts": 0.8, "a.ts c.ts": 0.1 }),
    );

    expect(family?.files).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(family?.similarity).toEqual({ min: 0.1, max: 0.8 });
  });
});

describe("familiesOf test code", () => {
  it("marks a family testOnly when every member is test code, not when one is production code", () => {
    const families = familiesFor({
      "a.test.ts test/b.ts": 0.7,
      "c.ts test/d.ts": 0.7,
    });

    expect(families.map(({ files, testOnly }) => [files, testOnly])).toEqual([
      [["c.ts", "test/d.ts"], false],
      [["a.test.ts", "test/b.ts"], true],
    ]);
  });

  it("does not take contract files in a spec directory for test code, but tests there", () => {
    const families = familiesFor({
      "spec/a.tsp spec/b.tsp": 0.7,
      "spec/c.test.ts spec/d.test.ts": 0.7,
    });

    expect(families.map(({ files, testOnly }) => [files[0], testOnly])).toEqual(
      [
        ["spec/a.tsp", false],
        ["spec/c.test.ts", true],
      ],
    );
  });

  it("ranks a family of test code only after the others, however often it changed", () => {
    const families = familiesFor(
      { "a.test.ts b.test.ts": 0.9, "d.ts e.ts": 0.6 },
      historyOf(...Array.from({ length: 4 }, () => commit([0, 1]))),
    );

    expect(families.map(({ files, testOnly }) => [files[0], testOnly])).toEqual(
      [
        ["d.ts", false],
        ["a.test.ts", true],
      ],
    );
  });
});

describe("familiesOf changes", () => {
  const table = { "a.ts b.ts": 0.7, "b.ts c.ts": 0.7 };

  it("counts the commits that touched two members and the commits that touched all of them", () => {
    const [family] = familiesFor(
      table,
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
    const [family] = familiesFor(
      { "a.ts b.ts": 0.7 },
      historyOf(commit([0, 1]), commit([0, 1], 51)),
    );

    expect(family).toMatchObject({ sharedChanges: 1, changesToAll: 1 });
  });

  it("ranks the family with more fixes applied to all members first", () => {
    const families = familiesFor(
      { "a.ts b.ts": 0.9, "d.ts e.ts": 0.6 },
      historyOf(commit([0, 1]), commit([3, 4]), commit([3, 4]), commit([3, 4])),
    );

    expect(families.map(({ files }) => files[0])).toEqual(["d.ts", "a.ts"]);
  });
});
