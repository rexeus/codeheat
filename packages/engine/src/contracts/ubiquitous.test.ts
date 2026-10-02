import { describe, expect, it } from "vitest";

import { findUbiquitous } from "./ubiquitous.js";

const PATHS = ["api/openapi.yaml", "api/orders.tsp", "src/app.ts"];
const CONTRACTS = new Set(["api/openapi.yaml", "api/orders.tsp"]);

/** `count` commits that touched the files with these ids, each as large as the files it lists. */
const commits = (count: number, ...ids: ReadonlyArray<number>) =>
  Array.from({ length: count }, () => ({
    files: Uint32Array.from(ids),
    size: ids.length,
  }));

const ubiquitousIn = (history: ReturnType<typeof commits>) =>
  findUbiquitous({ commits: history, paths: PATHS }, CONTRACTS);

describe("findUbiquitous", () => {
  it("reports a contract in more than 30 % of the counted commits, with its share", () => {
    const history = [...commits(10, 0, 2), ...commits(15, 2)];

    expect(ubiquitousIn(history)).toStrictEqual([
      { path: "api/openapi.yaml", commits: 10, share: 0.4 },
    ]);
  });

  it("keeps a contract at exactly 30 % of the commits", () => {
    expect(ubiquitousIn([...commits(12, 0), ...commits(28, 2)])).toStrictEqual(
      [],
    );
  });

  it("needs at least ten commits, however large the share", () => {
    expect(ubiquitousIn(commits(9, 0))).toStrictEqual([]);
    expect(ubiquitousIn(commits(10, 0))).toStrictEqual([
      { path: "api/openapi.yaml", commits: 10, share: 1 },
    ]);
  });

  it("never sets code aside, however often it changes", () => {
    expect(ubiquitousIn(commits(20, 2))).toStrictEqual([]);
  });

  it("counts only the commits small enough to count, on both sides of the share", () => {
    const huge = Array.from({ length: 80 }, () => ({
      files: Uint32Array.of(1),
      size: 51,
    }));
    const history = [...commits(15, 0, 2), ...commits(25, 2), ...huge];

    // 15 of the 40 counted commits; the 80 oversized ones that touched orders.tsp do not count
    expect(ubiquitousIn(history)).toStrictEqual([
      { path: "api/openapi.yaml", commits: 15, share: 0.375 },
    ]);
  });

  it("lists the most changed first", () => {
    const history = [...commits(8, 0, 1), ...commits(2, 1), ...commits(5, 0)];

    expect(ubiquitousIn(history).map(({ path }) => path)).toStrictEqual([
      "api/openapi.yaml",
      "api/orders.tsp",
    ]);
  });
});
