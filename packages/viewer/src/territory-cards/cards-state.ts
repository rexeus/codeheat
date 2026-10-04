// Owns what the reader has chosen in "Where the heat is": the detail, which
// cards are expanded, and whether all cards are shown.
import type { TerritoryCard } from "./card-model.js";

export type CardsState = {
  /** The `level` of the territories shown. */
  readonly detail: number;
  /** The `id`s of the expanded cards. */
  readonly expanded: ReadonlySet<string>;
  readonly showAll: boolean;
};

/** How many cards are shown before the reader asks for the rest. */
const INITIAL_CARDS = 12;

/** Reads the report's recommended detail first, with every card collapsed. */
export const initialState = (recommended: number): CardsState => ({
  detail: recommended,
  expanded: new Set(),
  showAll: false,
});

/**
 * Switches to `detail` when the report has it among `levels`. The cards
 * of another detail are other territories, so the expanded cards and the
 * request to show all start over; choosing the detail already shown changes nothing.
 */
export const selectDetail = (
  state: CardsState,
  detail: number,
  levels: readonly number[],
): CardsState =>
  detail === state.detail || !levels.includes(detail)
    ? state
    : { detail, expanded: new Set(), showAll: false };

/** Expands the card `id`, or collapses it when it is expanded. */
export const toggleExpanded = (state: CardsState, id: string): CardsState => {
  const expanded = new Set(state.expanded);
  if (!expanded.delete(id)) {
    expanded.add(id);
  }
  return { ...state, expanded };
};

export const showAllCards = (state: CardsState): CardsState => ({
  ...state,
  showAll: true,
});

/** The cards a reader sees, and what the rest hold. */
export type Shown = {
  readonly cards: readonly TerritoryCard[];
  /** How many cards wait behind the button; 0 when all are shown. */
  readonly hidden: number;
  /** The share of the change effort that the hidden cards hold. */
  readonly hiddenHeat: number;
};

/** The first `INITIAL_CARDS` cards, or all of them once asked. */
export const shownCards = (
  cards: readonly TerritoryCard[],
  { showAll }: CardsState,
): Shown => {
  const shown = showAll ? cards : cards.slice(0, INITIAL_CARDS);
  const hidden = cards.slice(shown.length);
  return {
    cards: shown,
    hidden: hidden.length,
    hiddenHeat: hidden.reduce((sum, card) => sum + card.heatShare, 0),
  };
};
