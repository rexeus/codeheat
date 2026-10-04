import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { territoryNode } from "../testing/reports.js";
import {
  collapsedNote,
  emptyListsNote,
  farApart,
  matrixNote,
  noDistantPairs,
} from "./empty-notes.js";
import { matrixOf } from "./matrix-data.js";
import { capNote } from "./matrix-legend.js";

const LIMITS = { minModuleCommits: 5, minLocalDistance: 3 };
const MATRIX_LIMITS = {
  maxCommitFiles: 50,
  minModuleCommits: 5,
  maxCoupledTerritories: 24,
};

/** A matrix over territories with the given counted changes, all at one detail. */
const matrixWith = (changes: readonly number[]) =>
  matrixOf(
    indexTerritories({
      recommended: 1,
      details: [{ level: 1, ids: changes.map((_, index) => `t${index}`) }],
      nodes: [
        territoryNode("root", ".", { fit: null }),
        ...changes.map((count, index) =>
          territoryNode(`t${index}`, `src/p${index}`, {
            parent: "root",
            changes: count,
            heatShare: 0.5 - index * 0.01,
          }),
        ),
      ],
    }),
    [],
    MATRIX_LIMITS,
  );

const NONE = { cliques: 0, pairs: 0, families: 0 };

describe("matrixNote", () => {
  it("says the matrix has nothing to compare when no territory has enough changes", () => {
    expect(matrixNote(matrixWith([2, 3]), LIMITS)).toBe(
      "No territory has the 5 changes it takes to compare it with another.",
    );
  });

  it("names the one territory that could be compared and does not draw a matrix of one", () => {
    expect(matrixNote(matrixWith([12, 3]), LIMITS)).toBe(
      "Only src/p0 has the 5 changes it takes to compare it with another, so there is nothing to set it against.",
    );
  });

  it("says nothing for a matrix of two or more territories", () => {
    expect(matrixNote(matrixWith([12, 9]), LIMITS)).toBeNull();
  });

  it("says the report has no territories when there are none", () => {
    expect(matrixNote(matrixWith([]), LIMITS)).toContain(
      "no territories, so there is no matrix",
    );
  });
});

describe("capNote", () => {
  it("counts the territories of a matrix in the right number", () => {
    expect(capNote(matrixWith([12, 9, 8]))).toBe(
      "3 territories, hottest first; buckets and test code are left out.",
    );
  });
});

describe("collapsedNote", () => {
  const note =
    "No territory has the 5 changes it takes to compare it with another.";

  it("is one sentence for a section with neither a matrix nor any list entry", () => {
    expect(collapsedNote(note, NONE, 40)).toBe(
      `${note} No group of territories, no coupled file pair far apart and no family of copies outside test code changes together either.`,
    );
  });

  it("says the window has no counted changes when it has none", () => {
    expect(collapsedNote(note, NONE, 0)).toBe(
      "No counted changes in this window, so nothing changes together.",
    );
  });

  it("keeps the section when a list has an entry or a matrix is drawn", () => {
    expect(collapsedNote(note, { ...NONE, pairs: 1 }, 40)).toBeNull();
    expect(collapsedNote(null, NONE, 40)).toBeNull();
  });
});

describe("far apart", () => {
  it("is defined by modules and the folders apart within one", () => {
    expect(farApart(LIMITS)).toBe(
      "in different modules, or at least 3 folders apart within one",
    );
    expect(farApart({ ...LIMITS, minLocalDistance: 1 })).toBe(
      "in different modules, or at least 1 folder apart within one",
    );
  });

  it("is said next to an empty pairs list, with where nearby hidden coupling is listed", () => {
    expect(noDistantPairs(LIMITS)).toBe(
      'No coupled pair lies far apart (in different modules, or at least 3 folders apart within one). Hidden coupling between nearby files is not listed here; select a file in the map to see what changes with it, marked "no import".',
    );
  });

  it("is repeated in the one sentence that replaces three empty lists", () => {
    expect(emptyListsNote(NONE, LIMITS)).toContain("at least 3 folders apart");
    expect(emptyListsNote({ ...NONE, families: 1 }, LIMITS)).toBeNull();
  });
});
