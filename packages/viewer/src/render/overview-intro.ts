// Owns what the overview says in each color mode; the stylesheet shows only the current mode's copy.
import type { ColorMode } from "../color/color-mode.js";
import { h } from "./dom.js";

/** Marks `element` for one color mode; the stylesheet hides it in the others. */
const forMode = (mode: ColorMode, element: HTMLElement): HTMLElement => {
  element.dataset["modeOnly"] = mode;
  return element;
};

/** The overview's title and intro in each color mode. */
export const overviewIntro = (): HTMLElement[] => [
  forMode("heat", h("h2", "panel-title", "Hotspots")),
  forMode(
    "heat",
    h(
      "p",
      "hint",
      "Big and hot: many lines, changed often, deeply nested. Select a tile to outline the files that change together with it.",
    ),
  ),
  forMode("cohesion", h("h2", "panel-title", "Modules")),
  forMode(
    "cohesion",
    h(
      "p",
      "hint",
      "Cohesion is the share of a module's commits that touch no other module; low means its changes spread. Tiles take the color of their module. Select a tile to outline the files that change together with it.",
    ),
  ),
  forMode("change", h("h2", "panel-title", "Change")),
  forMode(
    "change",
    h(
      "p",
      "hint",
      "Cooler tiles got less hot than the window before, warmer tiles hotter; scores are normalized within each window, so this is a shift in standing. Files that were not active before are neutral. Select a tile to outline the files that change together with it.",
    ),
  ),
];
