import type { FileStats, Report } from "@codeheat/engine";

import { makeHeatScale } from "../color/heat-scale.js";
import { buildTree } from "../layout/hierarchy.js";
import { layoutTreemap } from "../layout/treemap.js";
import { createPathMatcher } from "../selection/filter.js";
import type { PathMatcher } from "../selection/filter.js";
import { highlightOf, selectionOf } from "../selection/highlight.js";
import type { Selection } from "../selection/highlight.js";
import { indexPartners } from "../selection/partners.js";
import { byId } from "./dom.js";
import { formatCount } from "./format.js";
import { renderHeader, renderLegend } from "./header.js";
import { createPanel } from "./panel.js";
import { createTooltip } from "./tooltip.js";
import { createTreemapView } from "./treemap-view.js";

/** The skeleton elements the page template provides. */
const findPage = () => ({
  stage: byId("stage", HTMLElement),
  filterInput: byId("filter", HTMLInputElement),
  filterCount: byId("filter-count", HTMLElement),
  treemap: byId("treemap", SVGSVGElement),
  tooltip: byId("tooltip", HTMLElement),
  panel: byId("panel", HTMLElement),
});

type Page = ReturnType<typeof findPage>;

/** Builds the tooltip, panel and treemap; every selection change goes to `select`. */
const createParts = (
  report: Report,
  page: Page,
  select: (path: string | null) => void,
) => {
  const tooltip = createTooltip(page.tooltip, page.stage, report.files.length);
  const heat = makeHeatScale(report.files.map(({ score }) => score));
  const panel = createPanel(
    page.panel,
    {
      files: new Map(report.files.map((file) => [file.path, file])),
      hotspots: report.files,
      heat,
      thresholds: report.thresholds,
    },
    {
      select,
      clear: () => {
        select(null);
      },
    },
  );
  const view = createTreemapView(page.treemap, heat, {
    hover: (leaf, event) => {
      if (leaf === null) {
        tooltip.hide();
      } else {
        tooltip.show(leaf, event);
      }
    },
    select,
  });
  return { panel, view };
};

const matchSummary = (
  matcher: PathMatcher | null,
  files: readonly FileStats[],
): string =>
  matcher === null
    ? ""
    : `${formatCount(files.filter(({ path }) => matcher(path)).length)} of ${formatCount(files.length)} files match`;

/**
 * Renders `report` into the skeleton the page template provides and wires
 * hover, selection, the filter and resizing. Every path reaches the DOM as text.
 */
export const mountViewer = (report: Report): void => {
  const page = findPage();
  const partnerIndex = indexPartners(report.couplings);
  const tree = buildTree(report.files, new Set(partnerIndex.keys()));
  let selection: Selection | null = null;
  let matcher: PathMatcher | null = null;

  const { panel, view } = createParts(report, page, (path) => {
    select(path);
  });

  const paint = (): void => {
    view.paint(({ node }) => {
      const path = node.kind === "file" ? node.path : null;
      return highlightOf(path, selection, matcher);
    }, selection);
  };

  const select = (path: string | null): void => {
    selection = path === null ? null : selectionOf(path, partnerIndex);
    if (selection === null) {
      panel.showOverview();
    } else {
      panel.showFile(selection.path, [...selection.partners.values()]);
    }
    paint();
  };

  const draw = (): void => {
    const size = {
      width: page.stage.clientWidth,
      height: page.stage.clientHeight,
    };
    view.draw(layoutTreemap(tree, size), size);
    paint();
  };

  renderHeader(
    report,
    byId("repository", HTMLElement),
    byId("summary", HTMLElement),
  );
  renderLegend(byId("legend", HTMLElement));
  panel.showOverview();
  draw();

  page.filterInput.addEventListener("input", () => {
    matcher = createPathMatcher(page.filterInput.value);
    page.filterCount.textContent = matchSummary(matcher, report.files);
    paint();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      select(null);
    }
  });
  new ResizeObserver(draw).observe(page.stage);
};
