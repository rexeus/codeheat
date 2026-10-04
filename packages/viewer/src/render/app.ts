import type { Report } from "@codeheat/engine";

import { makeHeatScale } from "../color/heat-scale.js";
import { heroDataOf } from "../hero/hero-data.js";
import type { HeroData } from "../hero/hero-data.js";
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
import type { PartnerIndex } from "../selection/partners.js";
import { mountDesignFit } from "./design-fit.js";
import { findPage, matchSummary, mountChrome } from "./page.js";
import type { Page } from "./page.js";
import { OVERVIEW_HOTSPOTS, createPanel } from "./panel.js";
import { createTooltip } from "./tooltip.js";
import { createTreemapView } from "./treemap-view.js";

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

/** Coupled files, the panel's hotspots, and the files places to start name stay selectable tiles when small files merge. */
const selectableFiles = (
  { files }: Report,
  partnerIndex: PartnerIndex,
  { entries }: HeroData,
): Set<string> =>
  new Set([
    ...partnerIndex.keys(),
    ...files.slice(0, OVERVIEW_HOTSPOTS).map(({ path }) => path),
    ...entries.flatMap((entry) => entry.files),
  ]);

/**
 * Renders `report` into the skeleton the page template provides and wires
 * hover, selection, the filter and resizing. Every path reaches the DOM as text.
 */
export const mountViewer = (report: Report): void => {
  const page = findPage();
  const partnerIndex = indexPartners(report.couplings);
  const design = heroDataOf(report);
  const tree = buildTree(
    report.files,
    selectableFiles(report, partnerIndex, design),
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
  mountDesignFit(design, report.files, select);
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
