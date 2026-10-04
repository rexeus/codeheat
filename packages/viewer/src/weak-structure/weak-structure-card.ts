import type { Answer, AnswerBody } from "../answers/answer-card.js";
import { chartNote, chartRows, nameLabel } from "../answers/parts.js";
import { containmentStep } from "../color/containment-scale.js";
import { h } from "../render/dom.js";
import { formatShare, plural } from "../render/format.js";
import { swarmOf } from "./swarm.js";
import type { BoundaryRow, WeakStructure } from "./weak-structure.js";

/** The width the strip's dots are placed in, in pixels; the strip stretches to its card. */
const STRIP_WIDTH = 300;
const STRIP_PADDING = 8;
/** Radius of the hottest territory's dot, and the least any dot gets, in pixels. */
const LARGEST_DOT = 15;
const SMALLEST_DOT = 3.5;
/** Territories listed in the chart. */
const CHART_ROWS = 20;

/** Where a share of changes kept inside lies along the strip, in percent of its width. */
const along = (containment: number): number =>
  ((STRIP_PADDING + containment * (STRIP_WIDTH - 2 * STRIP_PADDING)) /
    STRIP_WIDTH) *
  100;

const positioned = (
  className: string,
  left: number,
  text = "",
): HTMLElement => {
  const element = h("span", className, text);
  element.style.left = `${left}%`;
  return element;
};

/** A dot colored by the share of changes `containment` that stays inside. */
const containmentDot = (
  className: string,
  containment: number,
  limit: number,
): HTMLElement => {
  const dot = positioned(className, along(containment));
  dot.dataset["containment"] = containmentStep(containment, limit);
  return dot;
};

/** Every judged territory as a dot at the share of its changes that stay inside, sized by its heat, against the leak line. */
const strip = (rows: readonly BoundaryRow[], limit: number): HTMLElement => {
  const max = Math.max(...rows.map(({ heatShare }) => heatShare), 1e-9);
  const placed = swarmOf(
    rows.map(({ containment, heatShare }) => ({
      x: (along(containment) / 100) * STRIP_WIDTH,
      r: Math.max(SMALLEST_DOT, Math.sqrt(heatShare / max) * LARGEST_DOT),
    })),
  );
  const reach = Math.max(...placed.map(({ y, r }) => Math.abs(y) + r));
  const dots = rows.map((row, index) => {
    const dot = containmentDot("strip-dot", row.containment, limit);
    const { y = 0, r = SMALLEST_DOT } = placed[index] ?? {};
    dot.style.top = `calc(50% + ${y}px)`;
    dot.style.setProperty("--size", `${2 * r}px`);
    dot.title = `${row.name.dir}${row.name.base}: ${formatShare(row.containment)} stays inside`;
    return dot;
  });
  const plot = h(
    "span",
    "strip-plot",
    h("span", "strip-axis", ""),
    positioned("strip-limit", along(limit)),
    ...dots.toReversed(),
  );
  plot.style.height = `${Math.max(64, 2 * reach + 12)}px`;
  plot.style.setProperty("--zone", `${along(limit)}%`);
  return h(
    "span",
    "containment-strip",
    h(
      "span",
      "strip-ends",
      h("span", "strip-leaks", "Leaks"),
      h("span", "strip-holds", "Holds"),
    ),
    plot,
    h(
      "span",
      "strip-scale",
      h("span", "", "0%"),
      positioned(
        "strip-limit-label",
        along(limit),
        `${formatShare(limit)} stays inside`,
      ),
      h("span", "", "100%"),
    ),
  );
};

const lollipop = (containment: number, limit: number): HTMLElement => {
  const track = h(
    "span",
    "lollipop",
    h("span", "strip-axis", ""),
    positioned("strip-limit", along(limit)),
    containmentDot("lollipop-dot", containment, limit),
  );
  track.style.setProperty("--zone", `${along(limit)}%`);
  return track;
};

const chartRow = (row: BoundaryRow, limit: number): HTMLElement => {
  const value = h("strong", "chart-value", formatShare(row.containment));
  value.dataset["standing"] = row.leaks ? "leaks" : "holds";
  return h(
    "div",
    "chart-row",
    h("span", "chart-name", nameLabel(row.name)),
    lollipop(row.containment, limit),
    value,
    h(
      "span",
      "tag",
      row.partner === null
        ? ""
        : `→ ${row.partner.name} ${formatShare(row.partner.share)}`,
    ),
  );
};

const bodyOf = (model: WeakStructure): AnswerBody => {
  if (model.kind === "none") {
    return { kind: "empty", note: model.note };
  }
  const { rows, limit, leaking, leakShare, unjudged } = model;
  const hidden = rows.length - CHART_ROWS;
  const notes = [
    ...(hidden > 0
      ? [
          `${plural(hidden, "cooler territory is", "cooler territories are")} not listed.`,
        ]
      : []),
    ...(unjudged > 0
      ? [
          `${plural(unjudged, "territory has", "territories have")} too few changes, or no partner, to judge.`,
        ]
      : []),
  ];
  return {
    kind: "answer",
    figure: `${leaking} of ${rows.length}`,
    unit: "leak",
    sub: [h("strong", "", formatShare(leakShare)), " of all heat sits in them"],
    visual: [strip(rows, limit)],
    chart: {
      title: "How much of each territory's change stays inside",
      intro: `At ${formatShare(limit)} or less a boundary leaks: changes keep reaching into other territories. The arrow names the territory a territory's changes reach most, and how often.`,
      content: [
        chartRows(
          rows.slice(0, CHART_ROWS).map((row) => chartRow(row, limit)),
          "boundary-rows",
        ),
        ...chartNote(notes.join(" ")),
      ],
    },
  };
};

/** The card "Where the structure is weak". */
export const weakStructureAnswer = (model: WeakStructure): Answer => ({
  question: "Where the structure is weak",
  icon: "leak",
  body: bodyOf(model),
});
