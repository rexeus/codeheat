import { h } from "../render/dom.js";
import { icon } from "./icon.js";
import type { IconName } from "./icon.js";

type Child = Node | string;

/** The compact chart a card opens below the cards. */
type AnswerChart = {
  readonly title: string;
  readonly intro: string;
  readonly content: readonly Child[];
};

/** What a card says: an answer with its figure, a line under it, a small visual, and its chart; or, with nothing to show, a plain note. */
export type AnswerBody =
  | { readonly kind: "empty"; readonly note: string }
  | {
      readonly kind: "answer";
      /** The headline number, such as `57%`. */
      readonly figure: string;
      /** What the number counts, such as `of heat`. */
      readonly unit: string;
      readonly sub: readonly Child[];
      readonly visual: readonly Child[];
      readonly chart: AnswerChart;
    };

export type Answer = {
  readonly question: string;
  readonly icon: IconName;
  readonly body: AnswerBody;
};

/** The id of the one region below the cards that shows the open chart; every card controls it. */
export const CHART_REGION_ID = "answer-chart";
/** The id of the heading of the chart in the region, which names the region and takes focus. */
export const CHART_TITLE_ID = "answer-chart-title";

/** A card on the page, and the content of the chart it opens in the region; `chart` is `null` for a card with nothing to chart. */
export type RenderedAnswer = {
  readonly card: HTMLElement;
  readonly chart: readonly Child[] | null;
};

/** The card's number, for the eye: screen readers name the card by its question. */
const numberOf = (number: number): HTMLElement => {
  const element = h("span", "answer-number", String(number));
  element.setAttribute("aria-hidden", "true");
  return element;
};

const eyebrow = (number: number, answer: Answer, id: string): HTMLElement => {
  const element = h(
    "span",
    "answer-eyebrow",
    numberOf(number),
    icon(answer.icon),
    answer.question,
  );
  element.id = id;
  return element;
};

const withId = <T extends HTMLElement>(element: T, id: string): T => {
  element.id = id;
  return element;
};

/** The content of a chart: its heading, which can take focus, its intro, and its rows. */
const chartOf = ({ title, intro, content }: AnswerChart): Child[] => {
  const heading = withId(h("h2", "chart-title", title), CHART_TITLE_ID);
  heading.tabIndex = -1;
  return [
    h("header", "chart-head", heading, h("p", "chart-intro", intro)),
    ...content,
  ];
};

/**
 * Renders the card for the `number`th answer. A card with an answer is a
 * button that opens its chart in the region below the cards
 * (`aria-expanded`, `aria-controls`), named by its question, figure, and the
 * line under it; a card without one only says why, and opens nothing.
 */
export const renderAnswer = (
  number: number,
  answer: Answer,
): RenderedAnswer => {
  const id = `answer-${number}`;
  const { body } = answer;
  if (body.kind === "empty") {
    const card = h(
      "div",
      "answer-card",
      eyebrow(number, answer, `${id}-question`),
      h("p", "answer-note", body.note),
    );
    card.dataset["empty"] = "true";
    return { card, chart: null };
  }
  const card = h(
    "button",
    "answer-card",
    eyebrow(number, answer, `${id}-question`),
    withId(
      h(
        "span",
        "answer-figure",
        h("span", "answer-value", body.figure),
        " ",
        h("span", "answer-unit", body.unit),
      ),
      `${id}-figure`,
    ),
    withId(h("span", "answer-sub", ...body.sub), `${id}-sub`),
    h("span", "answer-visual", ...body.visual),
  );
  card.type = "button";
  card.setAttribute("aria-expanded", "false");
  card.setAttribute("aria-controls", CHART_REGION_ID);
  card.setAttribute("aria-labelledby", `${id}-question ${id}-figure ${id}-sub`);
  return { card, chart: chartOf(body.chart) };
};
