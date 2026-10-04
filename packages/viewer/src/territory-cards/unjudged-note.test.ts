import { describe, expect, it } from "vitest";

import { reportWithParts } from "../testing/design-fit.js";
import { cardsAt } from "../testing/territory-cards.js";
import { listUnjudgedLabel, unjudgedNote } from "./unjudged-note.js";

const LIMITS = { changes: 120, minChanges: 5 };

const cardsOf = (containments: readonly (number | null)[]) =>
  cardsAt(
    reportWithParts(
      containments.map((containment, index) => ({
        id: `t${index + 1}`,
        path: `src/p${index + 1}`,
        heat: 0.1,
        containment,
      })),
    ),
    1,
  );

describe("unjudgedNote", () => {
  it("says nothing while at least one territory is judged", () => {
    expect(unjudgedNote(cardsOf([null, 0.5]), LIMITS)).toBeNull();
  });

  it("says nothing without cards", () => {
    expect(unjudgedNote([], LIMITS)).toBeNull();
  });

  it("names the number of changes it takes when changes were counted", () => {
    expect(unjudgedNote(cardsOf([null, null]), LIMITS)).toBe(
      "No territory has the 5 counted changes it takes to be judged, so none can be compared.",
    );
  });

  it("says the window has no counted changes when it has none", () => {
    expect(unjudgedNote(cardsOf([null]), { ...LIMITS, changes: 0 })).toBe(
      "No counted changes in this window, so no territory can be judged.",
    );
  });
});

describe("listUnjudgedLabel", () => {
  it("counts the territories and agrees with the count", () => {
    expect(listUnjudgedLabel(cardsOf([null, null, null]))).toBe(
      "List the 3 territories anyway",
    );
    expect(listUnjudgedLabel(cardsOf([null]))).toBe(
      "List the 1 territory anyway",
    );
  });
});
