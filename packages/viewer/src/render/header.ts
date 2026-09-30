import type { Report } from "@codeheat/engine";

import { HEAT_STEP_COUNT } from "../color/heat-scale.js";
import { h } from "./dom.js";
import { formatCount } from "./format.js";

const SHORT_SHA_LENGTH = 7;

const day = (timestamp: string): string => timestamp.slice(0, 10);

const summaryParts = ({ repository, window, files }: Report): string[] => [
  `${day(window.since)} → ${day(window.until)}`,
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

const heatRamp = (): HTMLElement => {
  const steps = Array.from({ length: HEAT_STEP_COUNT }, (_, step) => {
    const swatch = h("span", "swatch", "");
    swatch.dataset["step"] = String(step);
    return swatch;
  });
  return h(
    "span",
    "ramp",
    h("span", "muted", "none"),
    ...steps,
    h("span", "muted", "top 2%"),
  );
};

/** Explains the two encodings: tile area and tile color. */
export const renderLegend = (legend: HTMLElement): void => {
  legend.replaceChildren(
    h(
      "div",
      "legend-item",
      h("span", "muted", "Area"),
      h("strong", "", "lines of code"),
    ),
    h(
      "div",
      "legend-item",
      h("span", "muted", "Color"),
      h("strong", "", "hotspot rank"),
      heatRamp(),
    ),
  );
};
