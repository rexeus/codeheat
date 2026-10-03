// Owns what the overview says in each color mode; the stylesheet shows only the current mode's copy.
import type { ColorMode } from "../color/color-mode.js";
import { h } from "./dom.js";

/** Marks `element` for one color mode; the stylesheet hides it in the others. */
const forMode = (mode: ColorMode, element: HTMLElement): HTMLElement => {
  element.dataset["modeOnly"] = mode;
  return element;
};

const INTROS: ReadonlyArray<{
  readonly mode: ColorMode;
  readonly title: string;
  readonly hint: string;
}> = [
  {
    mode: "heat",
    title: "Hotspots",
    hint: "Big and hot: many lines, changed often, deeply nested. Select a tile to outline the files that change together with it.",
  },
  {
    mode: "cohesion",
    title: "Modules",
    hint: "Cohesion is the share of a module's changes that touch no other module; low means its changes spread. Tiles take the color of their module. Select a tile to outline the files that change together with it.",
  },
  {
    mode: "change",
    title: "Change",
    hint: "Cooler tiles got less hot than the window before, warmer tiles hotter; scores are normalized within each window, so this is a shift in standing. Files that were not active before are neutral. Select a tile to outline the files that change together with it.",
  },
];

/** The overview's title in each color mode, for an overview without content to explain. */
export const overviewTitles = (): HTMLElement[] =>
  INTROS.map(({ mode, title }) => forMode(mode, h("h2", "panel-title", title)));

/** The overview's title and intro in each color mode. */
export const overviewIntro = (): HTMLElement[] =>
  INTROS.flatMap(({ mode, title, hint }) => [
    forMode(mode, h("h2", "panel-title", title)),
    forMode(mode, h("p", "hint", hint)),
  ]);
