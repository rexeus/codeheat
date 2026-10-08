// Owns what the map shows: how its files are grouped, at which detail of the
// territories, and which territory fills it. Every change is a function from
// one view to the next, so the rules of what can be zoomed are in one place.
import type { FileStats, Analysis } from "@codeheat/engine";

import { buildTree } from "../layout/hierarchy.js";
import type { DirectoryNode } from "../layout/hierarchy.js";
import { buildGroupedTree, buildZoomTree } from "./grouped-tree.js";
import { groupFilesAt, visibleAt } from "./territory-groups.js";
import type { Group } from "./territory-groups.js";

type Territories = Analysis["territories"];

export type Grouping = "territories" | "folders";

export type MapView = {
  readonly grouping: Grouping;
  /** The detail of the territories the files are grouped at. */
  readonly detail: number;
  /** The id of the territory that fills the map, or `null` for all of them; only with `territories` grouping. */
  readonly zoom: string | null;
};

/** Grouped by territory at the recommended detail, as far as the report has territories; otherwise by folder. */
export const initialView = (territories: Territories): MapView => ({
  grouping: territories.details.length === 0 ? "folders" : "territories",
  detail: territories.recommended,
  zoom: null,
});

/** `view` grouped the other way; folders have no territory to zoom to. */
export const withGrouping = (view: MapView, grouping: Grouping): MapView => ({
  ...view,
  grouping,
  zoom: grouping === "folders" ? null : view.zoom,
});

/** `view` at another detail; a territory the new detail does not show is no longer zoomed to. */
export const withDetail = (
  view: MapView,
  detail: number,
  territories: Territories,
): MapView => ({
  ...view,
  detail,
  zoom:
    view.zoom !== null && visibleAt(territories, detail).has(view.zoom)
      ? view.zoom
      : null,
});

/**
 * `view` zoomed to the territory `id`, grouped by territory. Stays at the
 * detail that shows the territory, or moves to the recommended one, or to the
 * coarsest detail that shows it (a territory of a card at another detail); an
 * id no detail shows leaves the view as it is.
 */
export const zoomedTo = (
  view: MapView,
  id: string,
  territories: Territories,
): MapView => {
  const levels = [
    view.detail,
    territories.recommended,
    ...territories.details.map(({ level }) => level),
  ];
  const detail = levels.find((level) => visibleAt(territories, level).has(id));
  return detail === undefined
    ? view
    : { grouping: "territories", detail, zoom: id };
};

/** `view` zoomed out to every territory. */
export const zoomedOut = (view: MapView): MapView => ({ ...view, zoom: null });

/** What the treemap draws for a view. */
export type MapTree = {
  readonly root: DirectoryNode;
  /** The territory that fills the map; `null` when the whole report is shown. */
  readonly zoomed: Group | null;
  /** The files in the tree, for finding out whether a file can be shown without leaving the zoom. */
  readonly contains: (path: string) => boolean;
};

/**
 * The tree for `view` over `files`: the folders of every file, or a group per
 * territory at the view's detail, or the folders of one territory alone.
 * `keep` lists files that stay individual tiles.
 */
export const treeOf = (
  view: MapView,
  territories: Territories,
  files: readonly FileStats[],
  keep: ReadonlySet<string>,
): MapTree => {
  if (view.grouping === "folders") {
    const all = new Set(files.map(({ path }) => path));
    return {
      root: buildTree(files, keep),
      zoomed: null,
      contains: (path) => all.has(path),
    };
  }
  const groups = groupFilesAt(territories, files, view.detail);
  const zoomed = groups.find(({ territory }) => territory.id === view.zoom);
  if (zoomed === undefined) {
    const grouped = new Set(
      groups.flatMap((group) => group.files.map(({ path }) => path)),
    );
    return {
      root: buildGroupedTree(groups, keep),
      zoomed: null,
      contains: (path) => grouped.has(path),
    };
  }
  const inside = new Set(zoomed.files.map(({ path }) => path));
  return {
    root: buildZoomTree(zoomed, keep),
    zoomed,
    contains: (path) => inside.has(path),
  };
};
