import type { Answer, AnswerBody } from "../answers/answer-card.js";
import { bar, chartNote, chartRows, nameLabel } from "../answers/parts.js";
import { containmentStep } from "../color/containment-scale.js";
import { h } from "../render/dom.js";
import { formatCount, formatShare, plural } from "../render/format.js";
import type { CoChange, PairSide, TerritoryPair } from "./pairs.js";

/** Pairs listed on the card under the strongest one. */
const CARD_PAIRS = 3;
/** Pairs listed in the chart. */
const CHART_PAIRS = 20;
/** Shared changes from which the link is drawn at its thickest. */
const THICKEST_AT = 40;

/** A link between two names: solid, or dashed where some coupled files have no import between them, which the words beside it also say. */
const link = (pair: TerritoryPair): HTMLElement => {
  const line = h("span", "pair-dash", "");
  line.dataset["hidden"] = String(pair.hiddenPairs > 0);
  return line;
};

const node = (side: PairSide, limit: number): HTMLElement => {
  const dot = h("span", "pair-node", "");
  dot.dataset["containment"] = containmentStep(side.containment, limit);
  return dot;
};

const end = (side: PairSide): HTMLElement =>
  h(
    "span",
    "pair-end",
    nameLabel(side.name, true),
    h(
      "span",
      "pair-stays",
      side.containment === null
        ? "not judged"
        : `${formatShare(side.containment)} stays`,
    ),
  );

/** The strongest pair, drawn as two territories and the link between them, with the shared changes on it. */
const strongest = (pair: TerritoryPair, limit: number): HTMLElement => {
  const line = h(
    "span",
    "pair-line",
    h("span", "pair-count", formatCount(pair.sharedChanges)),
  );
  line.dataset["hidden"] = String(pair.hiddenPairs > 0);
  line.style.setProperty(
    "--weight",
    `${3 + 5 * Math.min(1, pair.sharedChanges / THICKEST_AT)}px`,
  );
  return h(
    "span",
    "pair-link",
    h("span", "pair-track", node(pair.a, limit), line, node(pair.b, limit)),
    h("span", "pair-ends", end(pair.a), end(pair.b)),
  );
};

const cardRow = (pair: TerritoryPair): HTMLElement =>
  h(
    "span",
    "mini-row pair-row",
    nameLabel(pair.a.name, true),
    link(pair),
    nameLabel(pair.b.name, true),
    h("strong", "mini-value", formatCount(pair.sharedChanges)),
  );

const pairTag = ({ hiddenPairs, filePairs }: TerritoryPair): HTMLElement[] => {
  if (hiddenPairs > 0) {
    return [
      h(
        "span",
        "tag",
        `${plural(hiddenPairs, "file pair", "file pairs")} with no import`,
      ),
    ];
  }
  return filePairs > 0
    ? [
        h(
          "span",
          "tag",
          plural(filePairs, "coupled file pair", "coupled file pairs"),
        ),
      ]
    : [h("span", "tag", "")];
};

const chartRow = (pair: TerritoryPair, max: number): HTMLElement =>
  h(
    "div",
    "chart-row",
    h(
      "span",
      "chart-name pair-names",
      nameLabel(pair.a.name, true),
      link(pair),
      nameLabel(pair.b.name, true),
    ),
    bar(pair.sharedChanges / max),
    h("strong", "chart-value", formatCount(pair.sharedChanges)),
    ...pairTag(pair),
  );

const bodyOf = (model: CoChange, limit: number): AnswerBody => {
  if (model.kind === "none") {
    return { kind: "empty", note: model.note };
  }
  const [first, ...rest] = model.pairs;
  const hidden = model.pairs.length - CHART_PAIRS;
  return {
    kind: "answer",
    figure: formatCount(first.sharedChanges),
    unit: first.sharedChanges === 1 ? "shared change" : "shared changes",
    sub: [
      h("strong", "", formatCount(model.hiddenPairs)),
      ` ${model.hiddenPairs === 1 ? "file pair" : "file pairs"} with no import`,
    ],
    visual: [
      strongest(first, limit),
      h(
        "span",
        "mini-rows",
        ...rest.slice(0, CARD_PAIRS).map((pair) => cardRow(pair)),
      ),
    ],
    chart: {
      title: "Territories that change together",
      intro:
        "Changes that touched both territories of a pair, strongest first. A dashed link: some of their coupled files have no import between them.",
      content: [
        chartRows(
          model.pairs
            .slice(0, CHART_PAIRS)
            .map((pair) => chartRow(pair, first.sharedChanges)),
          "pair-rows",
        ),
        ...chartNote(
          hidden > 0
            ? `${plural(hidden, "weaker pair is", "weaker pairs are")} not listed.`
            : "",
        ),
      ],
    },
  };
};

/** The card "What changes together"; `limit` is the leak line that colors each territory of the strongest pair. */
export const coChangeAnswer = (model: CoChange, limit: number): Answer => ({
  question: "What changes together",
  icon: "link",
  body: bodyOf(model, limit),
});
