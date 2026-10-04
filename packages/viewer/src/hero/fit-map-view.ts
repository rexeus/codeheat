import { breakable, h } from "../render/dom.js";
import { formatShare } from "../render/format.js";
import { rankBadge } from "../render/rank-badge.js";
import { layoutFitMap } from "../territories/fit-layout.js";
import type { FitTile } from "../territories/fit-tiles.js";
import { TOP_ENTRY_POINTS } from "../verdict/facts.js";

/** One marker per tile: the best place to start that concerns it, and how many more there are. */
const badgesOf = (ranks: readonly number[]): HTMLElement => {
  const [best, ...rest] = ranks;
  return h(
    "span",
    "fit-badges",
    ...(best === undefined ? [] : [rankBadge(best, `#entry-${best}`)]),
    ...(rest.length > 0 ? [h("span", "fit-more", `+${rest.length}`)] : []),
  );
};

/** A number in bold with the words that say what it counts. */
const figure = (value: string, words: string): (Node | string)[] => [
  h("strong", "", value),
  ` ${words}`,
];

/**
 * One territory as a tile. Its text is in the page twice: the visible parts
 * (name, share, description) appear as the tile's size allows, the full
 * summary is always there for assistive technology and the tooltip.
 */
const tileView = (tile: FitTile): HTMLElement => {
  const element = h(
    "div",
    "fit-tile",
    h("span", "sr-only", `${tile.summary}. ${tile.description}`),
    h(
      "span",
      "fit-head",
      h(
        "span",
        "fit-name",
        ...(tile.nameParts.dir === ""
          ? []
          : [h("span", "fit-dir", ...breakable(tile.nameParts.dir))]),
        h("span", "fit-base", ...breakable(tile.nameParts.base)),
      ),
      ...(tile.ranks.length > 0 ? [badgesOf(tile.ranks)] : []),
    ),
    h(
      "span",
      "fit-stat",
      ...(tile.containment === null
        ? [tile.noData ?? ""]
        : figure(formatShare(tile.containment), "of its changes stay inside")),
    ),
    h(
      "span",
      "fit-share",
      ...figure(formatShare(tile.heatShare), "of the effort"),
    ),
    h("span", "fit-desc", tile.description),
  );
  element.id = `territory-${tile.id}`;
  element.setAttribute("role", "listitem");
  element.title = `${tile.summary}\n${tile.description}`;
  element.dataset["fit"] = String(tile.step);
  element.dataset["kind"] = tile.kind;
  element.dataset["judged"] = String(tile.noData === null);
  element.dataset["top"] = String(
    tile.ranks.some((rank) => rank <= TOP_ENTRY_POINTS),
  );
  for (const label of element.querySelectorAll(
    ".fit-name, .fit-stat, .fit-share, .fit-desc",
  )) {
    label.setAttribute("aria-hidden", "true");
  }
  return element;
};

/** Labels that give way first when a tile is too small for its text: the description, then the share of effort, then the share that stays inside, then the folder, then the name shrinks, and last the name goes (it stays in the tooltip and the list). */
const TRIM_STEPS = 6;

const overflows = (element: HTMLElement): boolean =>
  element.scrollHeight > element.clientHeight ||
  element.scrollWidth > element.clientWidth;

/**
 * Hides the least important labels of `element` until its text fits. The
 * stylesheet shows labels by tile size, but font and wrapping differ between
 * systems, so a tile only keeps what it can show whole.
 */
const trimLabels = (element: HTMLElement): void => {
  delete element.dataset["trim"];
  for (let step = 1; step <= TRIM_STEPS && overflows(element); step += 1) {
    element.dataset["trim"] = String(step);
  }
};

/**
 * Draws the fit map into `container`: one tile per territory, laid out to the
 * container's size and again whenever it changes.
 */
export const renderFitMap = (
  container: HTMLElement,
  tiles: readonly FitTile[],
): void => {
  const elements = new Map(tiles.map((tile) => [tile.id, tileView(tile)]));
  container.replaceChildren(...elements.values());
  const place = (): void => {
    const rects = layoutFitMap(tiles, {
      width: container.clientWidth,
      height: container.clientHeight,
    });
    for (const [id, element] of elements) {
      const rect = rects.get(id);
      if (rect !== undefined) {
        element.style.left = `${rect.x}px`;
        element.style.top = `${rect.y}px`;
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
        trimLabels(element);
      }
    }
  };
  place();
  new ResizeObserver(place).observe(container);
};
