import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { reportWithParts } from "../testing/design-fit.js";
import { cardSourceOf, cardsOf } from "./card-model.js";
import {
  initialState,
  selectDetail,
  showAllCards,
  shownCards,
  toggleExpanded,
} from "./cards-state.js";
import { indexLevel } from "./level-index.js";

const LEVELS = [1, 2, 3];

describe("the detail", () => {
  it("starts at the recommended detail with nothing expanded", () => {
    const state = initialState(2);

    expect(state.detail).toBe(2);
    expect([...state.expanded]).toEqual([]);
    expect(state.showAll).toBe(false);
  });

  it("switches to a detail the report has", () => {
    expect(selectDetail(initialState(2), 3, LEVELS).detail).toBe(3);
  });

  it("ignores a detail the report does not have", () => {
    const state = initialState(2);

    expect(selectDetail(state, 6, LEVELS)).toBe(state);
  });

  it("keeps the state when the detail shown is chosen again", () => {
    const state = toggleExpanded(initialState(2), "t3");

    expect(selectDetail(state, 2, LEVELS)).toBe(state);
  });

  it("starts the cards over on another detail, because they are other territories", () => {
    const state = showAllCards(toggleExpanded(initialState(2), "t3"));

    const next = selectDetail(state, 1, LEVELS);

    expect(next.detail).toBe(1);
    expect([...next.expanded]).toEqual([]);
    expect(next.showAll).toBe(false);
  });
});

describe("expanding", () => {
  it("expands a card and collapses it on the next toggle", () => {
    const expanded = toggleExpanded(initialState(2), "t3");
    const collapsed = toggleExpanded(expanded, "t3");

    expect([...expanded.expanded]).toEqual(["t3"]);
    expect([...collapsed.expanded]).toEqual([]);
  });

  it("expands cards independently of each other", () => {
    const state = toggleExpanded(toggleExpanded(initialState(2), "t3"), "t4");

    expect([...state.expanded].toSorted()).toEqual(["t3", "t4"]);
  });

  it("does not change the state it was given", () => {
    const state = initialState(2);

    toggleExpanded(state, "t3");

    expect([...state.expanded]).toEqual([]);
  });
});

const manyParts = (count: number) => {
  const report = reportWithParts(
    Array.from({ length: count }, (_, index) => ({
      id: `p${index}`,
      path: `src/part-${index}`,
      heat: 0.01,
      containment: 0.5,
    })),
  );
  const level = indexLevel(report.territories, report.files, 1);
  const source = cardSourceOf(report, indexTerritories(report.territories), []);
  return cardsOf(source, level);
};

describe("shownCards", () => {
  it("shows every card of a short list", () => {
    const cards = manyParts(4);

    const shown = shownCards(cards, initialState(1));

    expect(shown.cards).toEqual(cards);
    expect(shown.hidden).toBe(0);
  });

  it("holds back the later cards of a long list and says what share of the effort they hold", () => {
    const cards = manyParts(30);

    const shown = shownCards(cards, initialState(1));

    expect(shown.cards.length).toBeLessThan(30);
    expect(shown.cards).toEqual(cards.slice(0, shown.cards.length));
    expect(shown.hidden).toBe(30 - shown.cards.length);
    expect(shown.hiddenHeat).toBeCloseTo(shown.hidden * 0.01);
  });

  it("shows all of a long list once asked", () => {
    const cards = manyParts(30);

    const shown = shownCards(cards, showAllCards(initialState(1)));

    expect(shown.cards).toEqual(cards);
    expect(shown.hidden).toBe(0);
    expect(shown.hiddenHeat).toBe(0);
  });
});
