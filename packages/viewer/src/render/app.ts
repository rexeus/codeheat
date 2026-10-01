import type { FileStats, Report } from "@codeheat/engine";

import { makeHeatScale } from "../color/heat-scale.js";
import { buildTree } from "../layout/hierarchy.js";
import type { LeafNode } from "../layout/hierarchy.js";
import { layoutTreemap } from "../layout/treemap.js";
import { indexModules } from "../modules/module-index.js";
import type { ModuleIndex } from "../modules/module-index.js";
import { createPathMatcher } from "../selection/filter.js";
import type { PathMatcher } from "../selection/filter.js";
import { highlightOf, selectionOf } from "../selection/highlight.js";
import type { Selection } from "../selection/highlight.js";
import { indexPartners } from "../selection/partners.js";
import { byId } from "./dom.js";
import { showEmptyNotice } from "./empty-report.js";
import { formatCount } from "./format.js";
import { renderHeader, renderLegend } from "./header.js";
import { mountModeSwitch } from "./mode-switch.js";
import { OVERVIEW_HOTSPOTS, createPanel } from "./panel.js";
import { createTooltip } from "./tooltip.js";
import { createTreemapView } from "./treemap-view.js";

/** The skeleton elements the page template provides. */
const findPage = () => ({
  app: byId("app", HTMLElement),
  modeSwitch: byId("mode-switch", HTMLFieldSetElement),
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
  modules: ModuleIndex,
  page: Page,
  select: (path: string | null) => void,
) => {
  const tooltip = createTooltip(
    page.tooltip,
    page.stage,
    report.files.length,
    modules,
  );
  const heat = makeHeatScale(report.files.map(({ score }) => score));
  const panel = createPanel(
    page.panel,
    {
      files: new Map(report.files.map((file) => [file.path, file])),
      hotspots: report.files,
      heat,
      modules: report.modules,
      moduleOf: modules.moduleOf,
      thresholds: report.thresholds,
    },
    {
      select,
      clear: () => {
        select(null);
      },
    },
  );
  const colors = {
    heat,
    cohesion: (node: LeafNode) =>
      modules.cohesionOf(node.kind === "file" ? [node.path] : node.paths),
  };
  const view = createTreemapView(page.treemap, colors, {
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

/** The heading, the legend and the color-mode switch. */
const mountChrome = (report: Report, page: Page): void => {
  renderHeader(
    report,
    byId("repository", HTMLElement),
    byId("summary", HTMLElement),
  );
  renderLegend(byId("legend", HTMLElement));
  mountModeSwitch(page.app, page.modeSwitch, report.comparison !== null);
  showEmptyNotice(report, page.stage);
};

/**
 * Renders `report` into the skeleton the page template provides and wires
 * hover, selection, the filter and resizing. Every path reaches the DOM as text.
 */
export const mountViewer = (report: Report): void => {
  const page = findPage();
  const partnerIndex = indexPartners(report.couplings);
  // Coupled files and the panel's hotspots stay selectable tiles when small files merge.
  const tree = buildTree(
    report.files,
    new Set([
      ...partnerIndex.keys(),
      ...report.files.slice(0, OVERVIEW_HOTSPOTS).map(({ path }) => path),
    ]),
  );
  let selection: Selection | null = null;
  let matcher: PathMatcher | null = null;

  const { panel, view } = createParts(
    report,
    indexModules(report.files, report.modules),
    page,
    (path) => {
      select(path);
    },
  );

  const paint = (): void => {
    view.paint(({ node }) => {
      const paths = node.kind === "file" ? [node.path] : node.paths;
      return highlightOf(paths, selection, matcher);
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

  mountChrome(report, page);
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
