import type { Report } from "@codeheat/engine";

import { createPathMatcher } from "../selection/filter.js";
import type { PathMatcher } from "../selection/filter.js";
import { matchSummary } from "../selection/match-summary.js";
import type { FilterScope } from "../selection/match-summary.js";
import { byId } from "./dom.js";
import { showEmptyNotice } from "./empty-report.js";
import { renderHeader, renderLegend } from "./header.js";
import { mountModeSwitch } from "./mode-switch.js";

/** The skeleton elements the page template provides. */
export const findPage = () => ({
  app: byId("app", HTMLElement),
  modeSwitch: byId("mode-switch", HTMLFieldSetElement),
  stage: byId("stage", HTMLElement),
  filterInput: byId("filter", HTMLInputElement),
  filterCount: byId("filter-count", HTMLElement),
  treemap: byId("treemap", SVGSVGElement),
  tooltip: byId("tooltip", HTMLElement),
  panel: byId("panel", HTMLElement),
});

export type Page = ReturnType<typeof findPage>;

/** The heading, the legend and the color-mode switch. */
export const mountChrome = (report: Report, page: Page): void => {
  renderHeader(report, {
    title: byId("repository", HTMLElement),
    summary: byId("summary", HTMLElement),
    comparison: byId("comparison", HTMLElement),
  });
  renderLegend(byId("legend", HTMLElement));
  mountModeSwitch(page.app, page.modeSwitch, report.comparison !== null);
  showEmptyNotice(report, page.stage);
};

/**
 * Reads the filter box on every keystroke: shows how many files of `scope()`
 * match and hands the matcher (or `null` for an empty filter) to `onChange`.
 * Returns a function that shows the count again, for when the scope changes.
 */
export const mountFilter = (
  page: Page,
  scope: () => FilterScope,
  onChange: (matcher: PathMatcher | null) => void,
): (() => void) => {
  let matcher: PathMatcher | null = null;
  const showCount = (): void => {
    page.filterCount.textContent = matchSummary(matcher, scope());
  };
  page.filterInput.addEventListener("input", () => {
    matcher = createPathMatcher(page.filterInput.value);
    showCount();
    onChange(matcher);
  });
  return showCount;
};
