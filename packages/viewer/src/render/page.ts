import type { FileStats, Report } from "@codeheat/engine";

import type { PathMatcher } from "../selection/filter.js";
import { byId } from "./dom.js";
import { showEmptyNotice } from "./empty-report.js";
import { formatCount } from "./format.js";
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

/** How many files the filter matches, or an empty string without a filter. */
export const matchSummary = (
  matcher: PathMatcher | null,
  files: readonly FileStats[],
): string =>
  matcher === null
    ? ""
    : `${formatCount(files.filter(({ path }) => matcher(path)).length)} of ${formatCount(files.length)} files match`;

/** The heading, the legend and the color-mode switch. */
export const mountChrome = (report: Report, page: Page): void => {
  renderHeader(
    report,
    byId("repository", HTMLElement),
    byId("summary", HTMLElement),
  );
  renderLegend(byId("legend", HTMLElement));
  mountModeSwitch(page.app, page.modeSwitch, report.comparison !== null);
  showEmptyNotice(report, page.stage);
};
