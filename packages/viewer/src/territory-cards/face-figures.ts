import { h } from "../render/dom.js";
import { formatShare } from "../render/format.js";
import type { TerritoryCard } from "./card-model.js";
import { meterView } from "./meter-view.js";

const figure = (value: string, words: string): HTMLElement =>
  h("div", "tcard-figure", h("strong", "", value), h("span", "", words));

/** A territory that is not judged has no containment to show: its share of the effort and why it is not judged are one quiet line. */
const compactFigures = ({ heatShare, noData }: TerritoryCard): HTMLElement =>
  h(
    "p",
    "tcard-compact",
    h("strong", "", formatShare(heatShare)),
    " of the change effort",
    h("span", "tcard-unjudged", `Not judged: ${noData ?? ""}`),
  );

/** The two numbers the card is about, and a meter for the second; a card that is not judged shows one line instead. */
export const figuresView = (card: TerritoryCard): HTMLElement => {
  if (card.containment === null) {
    return compactFigures(card);
  }
  const contained = figure(
    formatShare(card.containment),
    "of its changes stay inside",
  );
  contained.classList.add("tcard-contained");
  contained.append(meterView(card.containment, null));
  contained.dataset["fit"] = String(card.step);
  return h(
    "div",
    "tcard-figures",
    figure(formatShare(card.heatShare), "of the change effort"),
    contained,
  );
};
