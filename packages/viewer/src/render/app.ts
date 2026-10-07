import type { Analysis } from "@codeheat/engine";

import { mountAnswers } from "../answers/mount-answers.js";
import { layoutTreemap } from "../layout/treemap.js";
import { mountMapGrouping } from "../map-grouping/mount-map-grouping.js";
import { indexModules } from "../modules/module-index.js";
import type { PathMatcher } from "../selection/filter.js";
import { highlightOf, selectionOf } from "../selection/highlight.js";
import type { Selection } from "../selection/highlight.js";
import type { FilterScope } from "../selection/match-summary.js";
import { indexPartners } from "../selection/partners.js";
import { byId } from "./dom.js";
import { findPage, mountChrome, mountFilter } from "./page.js";
import type { Page } from "./page.js";
import type { Panel } from "./panel.js";
import { createParts } from "./parts.js";
import { selectableFiles } from "./selectable-files.js";

/** Fills the map with one territory and scrolls it into view. */
const territoryInMap =
  (zoom: (territory: string) => void) =>
  (id: string): void => {
    zoom(id);
    byId("map", HTMLElement).scrollIntoView({ block: "start" });
  };

/** The panel's view of a selection: the file with its partners, or the overview without one. */
const showSelection = (panel: Panel, selection: Selection | null): void => {
  if (selection === null) {
    panel.showOverview();
  } else {
    panel.showFile(selection.path, [...selection.partners.values()]);
  }
};

const stageSize = (stage: HTMLElement) => ({
  width: stage.clientWidth,
  height: stage.clientHeight,
});

/** Wires the filter box, the Escape key (which clears the selection), and resizing of the stage; returns the function that shows the filter's count again. */
const wirePage = (
  page: Page,
  scope: () => FilterScope,
  on: {
    readonly filter: (matcher: PathMatcher | null) => void;
    readonly clear: () => void;
    readonly resize: () => void;
  },
): (() => void) => {
  const showCount = mountFilter(page, scope, on.filter);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      on.clear();
    }
  });
  new ResizeObserver(on.resize).observe(page.stage);
  return showCount;
};

/**
 * Renders `report` into the skeleton the page template provides and wires
 * hover, selection, the filter and resizing. Every path reaches the DOM as text.
 */
export const mountViewer = (report: Analysis): void => {
  const page = findPage();
  const partnerIndex = indexPartners(report.couplings);
  const grouping = mountMapGrouping(
    report,
    selectableFiles(report, partnerIndex),
    () => {
      draw();
      showCount();
    },
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
    if (path !== null) {
      grouping.reveal(path);
    }
    selection = path === null ? null : selectionOf(path, partnerIndex);
    showSelection(panel, selection);
    paint();
  };

  const draw = (): void => {
    const size = stageSize(page.stage);
    view.draw(layoutTreemap(grouping.tree(), size), size);
    paint();
  };

  mountChrome(report, page);
  mountAnswers(report, territoryInMap(grouping.showTerritory));
  panel.showOverview();
  draw();

  const showCount = wirePage(page, grouping.scope, {
    filter: (next) => {
      matcher = next;
      paint();
    },
    clear: () => {
      select(null);
    },
    resize: draw,
  });
};
