import type { Report } from "@codeheat/engine";

import { CHANGE_STEP_COUNT } from "../color/change-scale.js";
import { COHESION_STEP_COUNT } from "../color/cohesion-scale.js";
import type { ColorMode } from "../color/color-mode.js";
import { HEAT_STEP_COUNT } from "../color/heat-scale.js";
import { h } from "./dom.js";
import { formatCount, formatDay } from "./format.js";

const SHORT_SHA_LENGTH = 7;

/** A caveat on the previous window: no commits means there is nothing to compare, cut off means less history. */
const comparisonCaveat = ({
  previousCommits,
  previousTruncated,
}: NonNullable<Report["comparison"]>): string => {
  if (previousCommits === 0) {
    return " (no commits: nothing to compare)";
  }
  return previousTruncated ? " (cut off at the start of the history)" : "";
};

const summaryParts = ({
  repository,
  window,
  files,
  comparison,
}: Report): string[] => [
  `${formatDay(window.since)} → ${formatDay(window.until)}`,
  ...(comparison === null
    ? []
    : [
        `compared with ${formatDay(comparison.previousSince)} → ${formatDay(comparison.previousUntil)}${comparisonCaveat(comparison)}`,
      ]),
  `${formatCount(window.commits)} commits`,
  `${formatCount(files.length)} files`,
  ...(repository.head === null
    ? []
    : [repository.head.slice(0, SHORT_SHA_LENGTH)]),
];

/** Fills the repository name and the window, commit and file summary. */
export const renderHeader = (
  report: Report,
  title: HTMLElement,
  summary: HTMLElement,
): void => {
  const { name, scope } = report.repository;
  title.textContent = scope === "." ? name : `${name} / ${scope}`;
  summary.textContent = summaryParts(report).join(" · ");
};

const swatchOf = (attribute: "step" | "cohesion" | "change", step: number) => {
  const swatch = h("span", "swatch", "");
  swatch.dataset[attribute] = String(step);
  return swatch;
};

const ramp = (...children: readonly Node[]): HTMLElement =>
  h("span", "ramp", ...children);

const heatRamp = (): HTMLElement =>
  ramp(
    h("span", "muted", "none"),
    ...Array.from({ length: HEAT_STEP_COUNT }, (_, step) =>
      swatchOf("step", step),
    ),
    h("span", "muted", "top 2%"),
  );

/** No-data swatch first and apart from the ramp: it is a state, not the low end. */
const cohesionRamp = (): HTMLElement =>
  ramp(
    swatchOf("cohesion", 0),
    h("span", "muted", "no data"),
    h("span", "ramp-gap", ""),
    h("span", "muted", "0%"),
    ...Array.from({ length: COHESION_STEP_COUNT - 1 }, (_, step) =>
      swatchOf("cohesion", step + 1),
    ),
    h("span", "muted", "100%"),
  );

/** Diverging: cooler to warmer around the unchanged step; no data first and apart, as in cohesion. */
const changeRamp = (): HTMLElement =>
  ramp(
    swatchOf("change", 0),
    h("span", "muted", "new or no data"),
    h("span", "ramp-gap", ""),
    h("span", "muted", "cooler"),
    ...Array.from({ length: CHANGE_STEP_COUNT - 1 }, (_, step) =>
      swatchOf("change", step + 1),
    ),
    h("span", "muted", "warmer"),
  );

/** A legend entry; `mode` limits it to one color mode, the stylesheet hides it otherwise. */
const item = (
  mode: ColorMode | null,
  ...children: readonly Node[]
): HTMLElement => {
  const element = h("div", "legend-item", ...children);
  if (mode !== null) {
    element.dataset["modeOnly"] = mode;
  }
  return element;
};

/** A sample of a partner outline, so the line styles of the treemap are explained. */
const outlineSample = (className: string, label: string): HTMLElement =>
  h("span", "outline-key", h("span", `outline-sample ${className}`, ""), label);

/**
 * Explains the encodings: tile area, tile color (per color mode) and the
 * partner outlines drawn once a file is selected.
 */
export const renderLegend = (legend: HTMLElement): void => {
  legend.replaceChildren(
    item(null, h("span", "muted", "Area"), h("strong", "", "lines of code")),
    item(
      "heat",
      h("span", "muted", "Color"),
      h("strong", "", "hotspot rank"),
      heatRamp(),
    ),
    item(
      "cohesion",
      h("span", "muted", "Color"),
      h("strong", "", "module cohesion"),
      cohesionRamp(),
    ),
    item(
      "change",
      h("span", "muted", "Color"),
      h("strong", "", "score change"),
      changeRamp(),
    ),
    item(
      null,
      h("span", "muted", "Partners"),
      outlineSample("partner", "same module"),
      outlineSample("partner cross-module", "other module"),
    ),
  );
};
