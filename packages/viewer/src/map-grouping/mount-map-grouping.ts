import type { FileStats, Analysis } from "@codeheat/engine";

import type { DirectoryNode } from "../layout/hierarchy.js";
import { byId, h } from "../render/dom.js";
import { formatCount } from "../render/format.js";
import {
  initialView,
  treeOf,
  withDetail,
  withGrouping,
  zoomedOut,
  zoomedTo,
} from "./map-view.js";
import type { Grouping, MapTree, MapView } from "./map-view.js";
import { detailChoices, groupName } from "./territory-groups.js";
import { returnFocusTo, zoomOrigin } from "./zoom-focus.js";

/** What the rest of the page asks of the map's grouping. */
export type MapGrouping = {
  /** The tree the treemap draws now. */
  readonly tree: () => DirectoryNode;
  /** Groups by territory and fills the map with the territory `id`; focus moves to the bar above the map. */
  readonly showTerritory: (id: string) => void;
  /** The files the filter counts against: those of the zoomed territory, else all, with the territory's name when zoomed. */
  readonly scope: () => {
    readonly files: readonly FileStats[];
    readonly territory: string | null;
  };
  /**
   * Zooms out when `path` is not in the zoomed territory, so that its tile is
   * there to select; returns whether the tree changed.
   */
  readonly reveal: (path: string) => boolean;
};

const GROUPINGS: readonly Grouping[] = ["territories", "folders"];

const parseGrouping = (value: string): Grouping | null =>
  GROUPINGS.find((grouping) => grouping === value) ?? null;

const optionLabel = ({
  level,
  territories,
  recommended,
}: ReturnType<typeof detailChoices>[number]): string =>
  `${level} · ${formatCount(territories)} ${territories === 1 ? "territory" : "territories"}${recommended ? " (recommended)" : ""}`;

/** What the bar above the map says while it shows one territory, and the way out. */
const zoomBar = ({ zoomed }: MapTree, zoomOut: () => void): HTMLElement[] => {
  if (zoomed === null) {
    return [];
  }
  const back = h("button", "zoom-out", "Show all territories");
  back.type = "button";
  back.addEventListener("click", zoomOut);
  return [
    h(
      "span",
      "zoom-what",
      "Showing ",
      h("strong", "", zoomed.territory.path),
      ` · ${formatCount(zoomed.files.length)} ${zoomed.files.length === 1 ? "file" : "files"}`,
    ),
    h("span", "zoom-desc", zoomed.territory.description),
    back,
  ];
};

/** The control that has focus now, unless focus is on the page itself. */
const focusedControl = (): HTMLElement | null => {
  const active = document.activeElement;
  return zoomOrigin(
    active instanceof HTMLElement ? active : null,
    document.body,
  );
};

/** The elements of the grouping controls the page template provides. */
const findControls = () => ({
  app: byId("app", HTMLElement),
  switcher: byId("grouping-switch", HTMLFieldSetElement),
  picker: byId("detail-pick", HTMLElement),
  select: byId("detail-select", HTMLSelectElement),
  bar: byId("zoom-bar", HTMLElement),
});

type Controls = ReturnType<typeof findControls>;

const detailOptions = (
  choices: ReturnType<typeof detailChoices>,
): HTMLOptionElement[] =>
  choices.map((choice) => {
    const option = h("option", "", optionLabel(choice));
    option.value = String(choice.level);
    return option;
  });

/** Makes the controls and the bar above the map say what `view` and `current` show. */
const showView = (
  { app, switcher, picker, select, bar }: Controls,
  view: MapView,
  current: MapTree,
  zoomOut: () => void,
): void => {
  app.dataset["grouping"] = current.zoomed === null ? view.grouping : "zoom";
  for (const input of switcher.querySelectorAll("input")) {
    input.checked = input.value === view.grouping;
  }
  select.value = String(view.detail);
  picker.hidden = view.grouping === "folders";
  const content = zoomBar(current, zoomOut);
  bar.hidden = content.length === 0;
  bar.replaceChildren(...content);
};

/**
 * Wires the map's grouping controls (by territory or by folder, the detail of
 * the territories, and the way out of a zoom) to the tree the treemap draws.
 * `onChange` runs after every change, when the treemap must draw again. A
 * report without territories is grouped by folder and shows no controls.
 */
export const mountMapGrouping = (
  report: Analysis,
  keep: ReadonlySet<string>,
  onChange: () => void,
): MapGrouping => {
  const { territories, files } = report;
  const controls = findControls();
  const choices = detailChoices(territories);
  let view: MapView = initialView(territories);
  let current = treeOf(view, territories, files, keep);
  let origin: HTMLElement | null = null;

  /** Zooms out by the bar's button, and returns focus to the control that zoomed in. */
  const leaveZoom = (): void => {
    apply(zoomedOut(view));
    const fallback =
      controls.switcher.querySelector<HTMLElement>("input:checked") ??
      controls.switcher;
    returnFocusTo(origin, fallback).focus();
    origin = null;
  };
  const apply = (next: MapView): void => {
    view = next;
    current = treeOf(view, territories, files, keep);
    showView(controls, view, current, leaveZoom);
    onChange();
  };

  controls.select.replaceChildren(...detailOptions(choices));
  controls.switcher.hidden = choices.length === 0;
  controls.switcher.addEventListener("change", ({ target }) => {
    const grouping =
      target instanceof HTMLInputElement ? parseGrouping(target.value) : null;
    if (grouping !== null) {
      apply(withGrouping(view, grouping));
    }
  });
  controls.select.addEventListener("change", () => {
    apply(withDetail(view, Number(controls.select.value), territories));
  });
  showView(controls, view, current, leaveZoom);

  return {
    tree: () => current.root,
    scope: () => ({
      files: current.zoomed?.files ?? files,
      territory: current.zoomed === null ? null : groupName(current.zoomed),
    }),
    showTerritory: (id) => {
      origin = focusedControl();
      apply(zoomedTo(view, id, territories));
      controls.bar.querySelector("button")?.focus({ preventScroll: true });
    },
    reveal: (path) => {
      if (current.contains(path) || view.zoom === null) {
        return false;
      }
      apply(zoomedOut(view));
      return true;
    },
  };
};
