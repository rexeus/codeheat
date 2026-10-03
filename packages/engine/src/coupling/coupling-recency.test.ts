import { describe, expect, it } from "vitest";

import { findCouplings } from "./coupling.js";

const PATHS = ["a.ts", "b.ts"];

/** `count` changes of the given weight touching the files with these ids. */
const commits = (count: number, weight: number, ...ids: Array<number>) =>
  Array.from({ length: count }, () => ({
    files: Uint32Array.from(ids),
    size: ids.length,
    weight,
  }));

/** A file with `changes` changes that weigh `weightedChanges` together. */
const file = (changes: number, weightedChanges: number) => ({
  changes,
  weightedChanges,
});

const couple = (
  history: ReturnType<typeof commits>,
  perFile: Readonly<Record<string, ReturnType<typeof file>>>,
) =>
  findCouplings(history, PATHS, new Map(Object.entries(perFile)), {
    modules: new Map(),
    contracts: new Set(),
  }).couplings;

const degrees = (couplings: ReturnType<typeof couple>) =>
  couplings.map(({ sharedCommits, degree }) => [sharedCommits, degree]);

describe("findCouplings recency", () => {
  it("divides the weight of the shared commits by the mean weighted revisions, shrunk towards the plain degree", () => {
    // three old shared commits (0.25 each), three recent commits of a alone (1 each)
    // a: 6 commits weighing 3.75, b: 3 commits weighing 0.75
    // weighted 0.75 / mean(3.75, 0.75) = 1/3; plain 3 / mean(6, 3) = 2/3
    // (0.75 + 3 × 2/3) / (2.25 + 3) = 0.5238
    const history = [...commits(3, 0.25, 0, 1), ...commits(3, 1, 0)];

    const couplings = couple(history, {
      "a.ts": file(6, 3.75),
      "b.ts": file(3, 0.75),
    });

    expect(degrees(couplings)).toStrictEqual([[3, 0.5238]]);
  });

  it("drops a pair whose files went their own ways recently, though plain counts would keep it", () => {
    // twelve recent commits of a alone: a has 15 commits weighing 12.75, b 3 weighing 0.75
    // plain 3 / mean(15, 3) = 0.3333; (0.75 + 3 × 0.3333) / (6.75 + 3) = 0.1795
    const history = [...commits(3, 0.25, 0, 1), ...commits(12, 1, 0)];

    expect(
      couple(history, { "a.ts": file(15, 12.75), "b.ts": file(3, 0.75) }),
    ).toStrictEqual([]);
  });

  it("keeps a pair that is old as a whole: the ratio does not depend on the scale of the weights", () => {
    const history = commits(3, 0.001, 0, 1);

    const couplings = couple(history, {
      "a.ts": file(3, 0.003),
      "b.ts": file(3, 0.003),
    });

    expect(degrees(couplings)).toStrictEqual([[3, 1]]);
  });
});

describe("findCouplings recency prior", () => {
  it("keeps a pair of many old shared commits near its plain degree when each file has a few recent commits", () => {
    // 16 shared commits at 0.0001 each; each file has 3 recent commits of its own (1 each)
    // weighted alone: 0.0016 / 3.0016 = 0.0005; plain 16 / 19 = 0.8421
    // (0.0016 + 3 × 0.8421) / (3.0016 + 3) = 0.4212
    const history = commits(16, 0.0001, 0, 1);

    const couplings = couple(history, {
      "a.ts": file(19, 3.0016),
      "b.ts": file(19, 3.0016),
    });

    expect(degrees(couplings)).toStrictEqual([[16, 0.4212]]);
  });

  it("follows the weighted degree where the recent commits are many", () => {
    // 30 recent shared commits (1 each); each file also has 5 old commits of its own (0.01 each)
    // weighted 30 / 30.05 = 0.9983; plain 30 / 35 = 0.8571
    // (30 + 3 × 0.8571) / (30.05 + 3) = 0.9855, close to the weighted degree
    const history = commits(30, 1, 0, 1);

    const couplings = couple(history, {
      "a.ts": file(35, 30.05),
      "b.ts": file(35, 30.05),
    });

    expect(degrees(couplings)).toStrictEqual([[30, 0.9855]]);
  });

  it("gates a pair on its plain shared commits, however much they weigh", () => {
    const history = commits(2, 1, 0, 1);

    expect(
      couple(history, { "a.ts": file(2, 2), "b.ts": file(2, 2) }),
    ).toStrictEqual([]);
  });

  it("keeps the degree at most 1 despite rounding in the sums of weights", () => {
    const history = commits(30, 0.1, 0, 1);

    const couplings = couple(history, {
      "a.ts": file(30, 3),
      "b.ts": file(30, 3),
    });

    expect(couplings.map(({ degree }) => degree)).toStrictEqual([1]);
  });

  it("reports the plain degree, rounded like the plain degree, when every commit weighs 1", () => {
    // 129 shared commits of files with 160 commits each: 0.80625 exactly, which rounds up to 0.8063
    const history = commits(129, 1, 0, 1);

    const couplings = couple(history, {
      "a.ts": file(160, 160),
      "b.ts": file(160, 160),
    });

    expect(degrees(couplings)).toStrictEqual([[129, 0.8063]]);
  });
});
