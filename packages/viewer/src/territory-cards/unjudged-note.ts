import { formatCount } from "../render/format.js";
import type { TerritoryCard } from "./card-model.js";

/** What decides why no territory is judged. */
export type UnjudgedLimits = {
  /** The changes that count in the window (`window.couplingCommits`). */
  readonly changes: number;
  /** Fewest counted changes a territory needs to be judged. */
  readonly minChanges: number;
};

/**
 * What "Where the heat is" says in place of a row of cards that all read
 * "Not judged": one sentence for why nothing can be compared. `null` when at
 * least one card is judged, or when there are no cards.
 */
export const unjudgedNote = (
  cards: readonly TerritoryCard[],
  { changes, minChanges }: UnjudgedLimits,
): string | null => {
  if (
    cards.length === 0 ||
    cards.some(({ containment }) => containment !== null)
  ) {
    return null;
  }
  return changes === 0
    ? "No counted changes in this window, so no territory can be judged."
    : `No territory has the ${formatCount(minChanges)} counted changes it takes to be judged, so none can be compared.`;
};

/** The words of the button that lists the cards anyway. */
export const listUnjudgedLabel = (cards: readonly TerritoryCard[]): string =>
  `List the ${formatCount(cards.length)} ${cards.length === 1 ? "territory" : "territories"} anyway`;
