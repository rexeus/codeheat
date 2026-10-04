import type { Report } from "@codeheat/engine";

import { entryViewsOf } from "../entry-points/entry-views.js";
import { indexTerritories } from "../territories/territory-index.js";
import { cardSourceOf, cardsOf } from "../territory-cards/card-model.js";
import { expansionOf } from "../territory-cards/expansion.js";
import { indexLevel } from "../territory-cards/level-index.js";

/** Everything the cards derive from `report`, with its places to start read as the page reads them. */
const sourceOf = (report: Report) => {
  const territories = indexTerritories(report.territories);
  return cardSourceOf(report, territories, entryViewsOf(report, territories));
};

/** All cards of `report` at detail `level`. */
export const cardsAt = (report: Report, level: number) =>
  cardsOf(
    sourceOf(report),
    indexLevel(report.territories, report.files, level),
  );

/** The card of the territory `id` at detail `level`; fails when there is none. */
export const cardAt = (report: Report, level: number, id: string) => {
  const found = cardsAt(report, level).find(
    ({ territory }) => territory.id === id,
  );
  if (found === undefined) {
    throw new Error(`no card ${id} at detail ${level}`);
  }
  return found;
};

/** What the expanded card of the territory `id` at detail `level` adds. */
export const expansionAt = (report: Report, level: number, id: string) => {
  const source = sourceOf(report);
  const index = indexLevel(report.territories, report.files, level);
  const cards = cardsOf(source, index);
  const card = cards.find(({ territory }) => territory.id === id);
  if (card === undefined) {
    throw new Error(`no card ${id} at detail ${level}`);
  }
  return expansionOf(card, cards, index, source);
};
