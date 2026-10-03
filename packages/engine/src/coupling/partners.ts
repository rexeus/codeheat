// Owns the directional view of coupling: what tends to change along with one file.
import { Order } from "effect";

import { isDistantCoupling } from "../distant/distant-couplings.js";
import type { InspectResult } from "../report/inspect-result.js";
import { roundReported } from "../report/precision.js";
import type { Coupling } from "../report/report.js";

/** A file that changes together with another. */
export type Partner = InspectResult["matches"][number]["partners"][number];

/** Indexes couplings under both of their paths. */
export const groupByPath = (
  couplings: ReadonlyArray<Coupling>,
): ReadonlyMap<string, ReadonlyArray<Coupling>> => {
  const grouped = new Map<string, Array<Coupling>>();
  for (const coupling of couplings) {
    for (const path of [coupling.a, coupling.b]) {
      const list = grouped.get(path);
      if (list === undefined) {
        grouped.set(path, [coupling]);
      } else {
        list.push(coupling);
      }
    }
  }
  return grouped;
};

/** `coupling.imports` seen from `path`, one of the coupled files. */
const importsFrom = (path: string, coupling: Coupling): Partner["imports"] => {
  const { imports } = coupling;
  if (imports === "a→b" || imports === "b→a") {
    return (imports === "a→b") === (coupling.a === path)
      ? "file→partner"
      : "partner→file";
  }
  return imports;
};

/**
 * The partners of `path` among its `couplings`, most likely to change along
 * with it first. `changes` is the number of logical changes that touched `path`.
 */
export const partnersOf = (
  path: string,
  changes: number,
  couplings: ReadonlyArray<Coupling>,
): ReadonlyArray<Partner> =>
  couplings
    .map((coupling) => ({
      path: coupling.a === path ? coupling.b : coupling.a,
      sharedCommits: coupling.sharedCommits,
      probability: roundReported(coupling.sharedCommits / changes),
      kind: coupling.a === path ? coupling.kinds.b : coupling.kinds.a,
      testPair: coupling.testPair,
      crossesModule: coupling.crossesModule,
      distant: isDistantCoupling(coupling),
      imports: importsFrom(path, coupling),
    }))
    .toSorted(
      (a, b) =>
        b.probability - a.probability ||
        b.sharedCommits - a.sharedCommits ||
        Order.String(a.path, b.path),
    );
