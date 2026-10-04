import type { Answer, AnswerBody } from "../answers/answer-card.js";
import {
  bar,
  chartNote,
  chartRows,
  nameLabel,
  standingTag,
} from "../answers/parts.js";
import { h } from "../render/dom.js";
import { formatShare, plural } from "../render/format.js";
import type { Concentration, HeatRow } from "./concentration.js";

/** Territories in the strip, each its own segment; the rest share one. */
const STRIP_SEGMENTS = 6;
/** Territories listed on the card. */
const CARD_ROWS = 4;
/** Territories listed in the chart. */
const CHART_ROWS = 20;

/** A segment of the strip: the `rank`th hottest territory, fading with rank, or the rest when `rank` is null. */
const segment = (grow: number, rank: number | null): HTMLElement => {
  const element = h("span", "strip-segment", "");
  element.style.flexGrow = String(Math.max(0, grow));
  if (rank === null) {
    element.dataset["rest"] = "true";
  } else {
    element.style.setProperty("--rank", String(rank));
  }
  return element;
};

const strip = (rows: readonly HeatRow[]): HTMLElement => {
  const shown = rows.slice(0, STRIP_SEGMENTS);
  const rest = 1 - shown.reduce((sum, { heatShare }) => sum + heatShare, 0);
  return h(
    "span",
    "heat-strip",
    ...shown.map(({ heatShare }, rank) => segment(heatShare, rank)),
    segment(rest, null),
  );
};

const cardRow = (row: HeatRow, max: number): HTMLElement =>
  h(
    "span",
    "mini-row",
    nameLabel(row.name, true),
    bar(row.heatShare / max),
    h("strong", "mini-value", formatShare(row.heatShare)),
  );

const chartRow = (
  row: HeatRow,
  max: number,
  showTerritory: (id: string) => void,
): HTMLElement => {
  const name = h("button", "chart-name", nameLabel(row.name));
  name.type = "button";
  name.title = `Show ${row.name.dir}${row.name.base} in the map`;
  name.addEventListener("click", () => {
    showTerritory(row.id);
  });
  return h(
    "div",
    "chart-row",
    name,
    bar(row.heatShare / max),
    h("strong", "chart-value", formatShare(row.heatShare)),
    standingTag(row.standing),
  );
};

const restNote = (rows: readonly HeatRow[], elsewhere: number): string => {
  const hidden = rows.slice(CHART_ROWS);
  const hiddenShare = hidden.reduce((sum, { heatShare }) => sum + heatShare, 0);
  const parts = [
    ...(hidden.length === 0
      ? []
      : [
          hiddenShare > 0
            ? `${plural(hidden.length, "smaller territory holds", "smaller territories hold")} ${formatShare(hiddenShare)}`
            : `${plural(hidden.length, "territory", "territories")} without change effort ${hidden.length === 1 ? "is" : "are"} not listed`,
        ]),
    ...(elsewhere >= 0.005
      ? [`test code and leftover files hold ${formatShare(elsewhere)}`]
      : []),
  ];
  const text = parts.join("; ");
  return text === ""
    ? ""
    : `${text.slice(0, 1).toUpperCase()}${text.slice(1)}.`;
};

const bodyOf = (
  model: Concentration,
  showTerritory: (id: string) => void,
): AnswerBody => {
  if (model.kind === "none") {
    return { kind: "empty", note: model.note };
  }
  const { rows, top, topShare, elsewhere } = model;
  const max = rows[0]?.heatShare ?? 1;
  return {
    kind: "answer",
    figure: formatShare(topShare),
    unit: "of all heat",
    sub: [
      "in ",
      h("strong", "", String(top)),
      ` of ${plural(rows.length, "territory", "territories")}`,
    ],
    visual: [
      strip(rows),
      h(
        "span",
        "mini-rows",
        ...rows.slice(0, CARD_ROWS).map((row) => cardRow(row, max)),
      ),
    ],
    chart: {
      title: "Heat by territory",
      intro:
        "Each territory's share of all the change effort, test code included, hottest first. Select one to show its files in the map.",
      content: [
        chartRows(
          rows
            .slice(0, CHART_ROWS)
            .map((row) => chartRow(row, max, showTerritory)),
          "heat-rows",
        ),
        ...chartNote(restNote(rows, elsewhere)),
      ],
    },
  };
};

/** The card "Where change concentrates"; a territory in its chart shows its files in the map through `showTerritory`. */
export const concentrationAnswer = (
  model: Concentration,
  showTerritory: (id: string) => void,
): Answer => ({
  question: "Where change concentrates",
  icon: "flame",
  body: bodyOf(model, showTerritory),
});
