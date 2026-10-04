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

/** A card on the page, and the chart it opens; `chart` is `null` for a card with nothing to chart. */
export type RenderedAnswer = {
  readonly card: HTMLElement;
  readonly chart: HTMLElement | null;
};

const eyebrow = (number: number, answer: Answer, id: string): HTMLElement => {
  const element = h(
    "span",
    "answer-eyebrow",
    h("span", "answer-number", String(number)),
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

const chartOf = ({ title, intro, content }: AnswerChart, id: string) => {
  const chart = h(
    "section",
    "answer-chart",
    h(
      "header",
      "chart-head",
      withId(h("h2", "chart-title", title), `${id}-title`),
      h("p", "chart-intro", intro),
    ),
    ...content,
  );
  chart.id = id;
  chart.hidden = true;
  chart.setAttribute("aria-labelledby", `${id}-title`);
  return chart;
};

/**
 * Renders the card for the `number`th answer. A card with an answer is a
 * button that opens its chart (`aria-expanded`, `aria-controls`), named by
 * its question, figure, and the line under it; a card without one only says
 * why, and opens nothing.
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
  card.setAttribute("aria-controls", `${id}-chart`);
  card.setAttribute("aria-labelledby", `${id}-question ${id}-figure ${id}-sub`);
  return { card, chart: chartOf(body.chart, `${id}-chart`) };
};
