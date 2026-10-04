import type { Answer, AnswerBody } from "../answers/answer-card.js";
import { icon } from "../answers/icon.js";
import type { IconName } from "../answers/icon.js";
import { chartNote } from "../answers/parts.js";
import { h } from "../render/dom.js";
import { formatShare, plural } from "../render/format.js";
import { TOP_ENTRY_POINTS } from "./entry-views.js";
import type { EntryView } from "./entry-views.js";
import { nonZeroStats } from "./evidence.js";
import type { EntryKind } from "./evidence.js";
import { rankBadge } from "./rank-badge.js";

/** Places listed on the card. */
const CARD_PLACES = 4;
/** Places shown in the chart. */
const CHART_PLACES = 6;
/** Evidence numbers shown per place in the chart. */
const KEY_NUMBERS = 3;

const KIND_ICONS: Record<EntryKind, IconName> = {
  boundary: "leak",
  hotspot: "flame",
  clique: "unit",
  copies: "copies",
  hub: "hub",
  coupling: "link",
};

const placeName = ({ name, title }: EntryView): HTMLElement => {
  const element = h("span", "place-name", name);
  element.title = title;
  return element;
};

const cardRow = (place: EntryView): HTMLElement =>
  h(
    "span",
    "place-row",
    rankBadge(place.rank),
    h(
      "span",
      "place-body",
      placeName(place),
      h("span", "place-move", icon(KIND_ICONS[place.kind]), place.moveLabel),
    ),
    h("strong", "place-heat", formatShare(place.heatShare)),
  );

const kindChip = ({ kind, kindLabel }: EntryView): HTMLElement => {
  const chip = h("span", "kind-chip", icon(KIND_ICONS[kind]), kindLabel);
  chip.dataset["kind"] = kind;
  return chip;
};

const placeCell = (place: EntryView): HTMLElement =>
  h(
    "article",
    "place-cell",
    h(
      "header",
      "place-head",
      rankBadge(place.rank),
      kindChip(place),
      h(
        "span",
        "place-stake",
        h("strong", "", formatShare(place.heatShare)),
        " of heat",
      ),
    ),
    h("h3", "place-title", placeName(place)),
    h("p", "place-verdict", place.verdict),
    h(
      "p",
      "place-design-move",
      h("strong", "", `${place.moveLabel}: `),
      place.move,
    ),
    h(
      "dl",
      "place-numbers",
      ...nonZeroStats(place.stats)
        .slice(0, KEY_NUMBERS)
        .map(({ value, label }) =>
          h("div", "place-number", h("dt", "", label), h("dd", "", value)),
        ),
    ),
  );

const bodyOf = (
  places: readonly EntryView[],
  topShare: number | null,
  noPlaces: string,
): AnswerBody => {
  if (places.length === 0 || topShare === null) {
    return { kind: "empty", note: noPlaces };
  }
  const top = Math.min(TOP_ENTRY_POINTS, places.length);
  const hidden = places.length - CHART_PLACES;
  return {
    kind: "answer",
    figure: formatShare(topShare),
    unit: "of heat",
    sub: [top === 1 ? "in the top place" : `in the top ${top} places`],
    visual: [
      h(
        "span",
        "place-rows",
        ...places.slice(0, CARD_PLACES).map((place) => cardRow(place)),
      ),
    ],
    chart: {
      title: "Places to start",
      intro:
        "Best first: the change effort at stake, times how clearly the design fails there. Each says what is wrong and what to do about it.",
      content: [
        h(
          "div",
          "place-cells",
          ...places.slice(0, CHART_PLACES).map((place) => placeCell(place)),
        ),
        ...chartNote(
          hidden > 0
            ? `${plural(hidden, "more place", "more places")} to start: codeheat analyze lists every one.`
            : "",
        ),
      ],
    },
  };
};

/**
 * The card "Where to start": `places` best first, `topShare` the share of the
 * heat in the territories of the top ones, and `noPlaces` what to say when
 * there are none.
 */
export const placesAnswer = (
  places: readonly EntryView[],
  topShare: number | null,
  noPlaces: string,
): Answer => ({
  question: "Where to start",
  icon: "target",
  body: bodyOf(places, topShare, noPlaces),
});
