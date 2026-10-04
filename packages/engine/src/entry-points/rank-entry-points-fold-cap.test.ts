import { describe, expect, it } from "vitest";

import {
  CODE_FILES,
  COPY_FILES,
  copies,
  heated,
  rankInput as input,
  territories,
} from "../testing/rank-input.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { rankEntryPoints } from "./rank-entry-points.js";

/** Only `f` is a real territory, so it is the one boundary; the others are buckets. */
const ONLY_F = territories(["other", "other", "other", "other", "other"]);

const unit = (modules: ReadonlyArray<string>, weakestShare: number) => ({
  modules,
  sharedCommits: 10,
  weakestShare,
  reason: "",
});

/** A strong clique of `a`, `b`, `c` and a weaker one of `d`, `e`, `f`; the weaker outranks the boundary of `f`. */
const CLIQUES = [unit(["a", "b", "c"], 0.8), unit(["d", "e", "f"], 0.5)];

const hub = (changedDependents: number) => ({
  path: `lib/hub${changedDependents}.ts`,
  module: "lib",
  fanIn: 20,
  changes: 10,
  medianDependentChanges: 2,
  changedDependents,
  dependents: [],
  reason: "",
});

const summary = (entries: ReturnType<typeof rankEntryPoints>) =>
  entries.map(({ kind, territories: ids, findings }) => [
    kind,
    ids.join("+"),
    findings.length,
  ]);

describe("rankEntryPoints folds after it picks", () => {
  it("keeps a boundary that only a cut clique explains", () => {
    // the clique of d, e, f scores ½ × 0.5 = 0.25, the boundary of f a ninth of that
    const ranked = rankEntryPoints(
      input({
        territories: ONLY_F,
        cliques: CLIQUES,
        limits: { ...DEFAULT_THRESHOLDS, maxEntriesPerKind: 1 },
      }),
    );

    // each kind keeps one entry: the clique of d, e, f is cut, so it folds nothing in
    expect(summary(ranked)).toStrictEqual([
      ["clique", "a+b+c", 1],
      ["boundary", "f", 1],
    ]);
  });

  it("folds the boundary into the clique that is picked", () => {
    const ranked = rankEntryPoints(
      input({ territories: ONLY_F, cliques: CLIQUES }),
    );

    expect(summary(ranked)).toStrictEqual([
      ["clique", "a+b+c", 1],
      ["clique", "d+e+f", 2],
    ]);
  });

  it("gives the place that a fold frees to the next best entry", () => {
    const ranked = rankEntryPoints(
      input({
        territories: ONLY_F,
        cliques: CLIQUES,
        files: [
          ...CODE_FILES,
          ...COPY_FILES,
          heated("lib/hub10.ts", "a", 100),
          heated("lib/hub8.ts", "a", 100),
        ],
        copyFamilies: [copies()],
        unstableInterfaces: [hub(10), hub(8)],
        limits: { ...DEFAULT_THRESHOLDS, maxEntries: 5 },
      }),
    );

    // the best of each kind (a clique, the boundary of f, copies, a hub) fill four places and
    // the second clique the fifth; it folds the boundary in, and the second hub takes the
    // place that frees
    expect(
      summary(ranked).map(([kind, , findings]) => [kind, findings]),
    ).toStrictEqual(
      expect.arrayContaining([
        ["clique", 2],
        ["hub", 1],
        ["copies", 1],
      ]),
    );
    expect(ranked.filter(({ kind }) => kind === "hub")).toHaveLength(2);
    expect(ranked.some(({ kind }) => kind === "boundary")).toBe(false);
    expect(ranked).toHaveLength(5);
  });
});
