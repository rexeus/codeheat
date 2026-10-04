import type { Report } from "@codeheat/engine";

import { makeHeatScale } from "../color/heat-scale.js";
import type { LeafNode } from "../layout/hierarchy.js";
import type { ModuleIndex } from "../modules/module-index.js";
import type { Page } from "./page.js";
import { createPanel } from "./panel.js";
import { createTooltip } from "./tooltip.js";
import { createTreemapView } from "./treemap-view.js";

/** Builds the tooltip, panel and treemap; every selection change goes to `select`. */
export const createParts = (
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
