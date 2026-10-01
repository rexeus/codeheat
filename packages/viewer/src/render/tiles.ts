import { changeStep, comparableChange } from "../color/change-scale.js";
import { cohesionStep } from "../color/cohesion-scale.js";
import type { HeatScale } from "../color/heat-scale.js";
import type { LeafNode } from "../layout/hierarchy.js";
import { fitLabel } from "../layout/label.js";
import { GROUP_HEADER_HEIGHT } from "../layout/treemap.js";
import type { PlacedGroup, PlacedLeaf } from "../layout/treemap.js";
import type { SvgFactory } from "./dom.js";
import { formatPercent, formatScore, formatScoreChange } from "./format.js";

const LABEL_INDENT = 4;
const MIN_LABEL_HEIGHT = 18;
const MIN_SCORE_LINE_HEIGHT = 42;

/** How a tile gets its color in each color mode. */
export type TileColors = {
  readonly heat: HeatScale;
  /** The cohesion a leaf is colored by in cohesion mode; `null` means no data. */
  readonly cohesion: (node: LeafNode) => number | null;
};

/** The score a leaf is colored by; an aggregate shows its hottest file. */
const leafScore = ({ node }: PlacedLeaf): number =>
  node.kind === "file" ? node.file.score : node.score;

/** The score change a leaf is colored by in change mode; see `comparableChange`. */
const leafScoreDelta = ({ node }: PlacedLeaf): number | null =>
  node.kind === "aggregate"
    ? node.scoreDelta
    : comparableChange(node.file.trend);

/** What the change line of a leaf says when it has no change to show. */
const unchangedText = ({ node }: PlacedLeaf): string =>
  node.kind === "file" && node.file.trend?.newlyActive === true
    ? "new"
    : "no data";

/** A group's background and, when it reserved a header strip and the name fits, its label. */
export const drawGroup = (
  create: SvgFactory,
  { name, rect, labelled }: PlacedGroup,
): SVGElement[] => {
  const width = rect.x1 - rect.x0;
  const box = create("rect", {
    class: "group",
    x: rect.x0,
    y: rect.y0,
    width,
    height: rect.y1 - rect.y0,
  });
  const label = labelled ? fitLabel(name, width - 2 * LABEL_INDENT) : null;
  if (label === null) {
    return [box];
  }
  const text = create("text", {
    class: "group-label",
    x: rect.x0 + LABEL_INDENT,
    y: rect.y0 + GROUP_HEADER_HEIGHT - 5,
  });
  text.textContent = label;
  return [box, text];
};

/**
 * One tile: a rectangle with the file name and, when there is room, a score
 * line. It carries a step for each color mode (`data-step` for heat,
 * `data-cohesion` for cohesion, `data-change` for change) and every score
 * line; the stylesheet shows the one of the active mode. `index` lets event handlers find the leaf again.
 */
export const drawLeaf = (
  create: SvgFactory,
  leaf: PlacedLeaf,
  index: number,
  colors: TileColors,
): SVGElement => {
  const { x0, y0, x1, y1 } = leaf.rect;
  const [width, height] = [x1 - x0, y1 - y0];
  const cohesion = colors.cohesion(leaf.node);
  const tile = create("g", {
    class: "tile",
    "data-index": index,
    "data-step": colors.heat(leafScore(leaf)),
    "data-cohesion": cohesionStep(cohesion),
    "data-change": changeStep(leafScoreDelta(leaf)),
  });
  tile.append(create("rect", { x: x0, y: y0, width, height }));
  const title =
    height >= MIN_LABEL_HEIGHT
      ? fitLabel(leaf.node.name, width - 2 * LABEL_INDENT)
      : null;
  if (title === null) {
    return tile;
  }
  const name = create("text", {
    class: "tile-name",
    x: x0 + LABEL_INDENT,
    y: y0 + 13,
  });
  name.textContent = title;
  tile.append(name);
  if (height >= MIN_SCORE_LINE_HEIGHT) {
    const score = create("text", {
      class: "tile-score",
      x: x0 + LABEL_INDENT,
      y: y0 + 26,
    });
    score.textContent = formatScore(leafScore(leaf));
    const share = create("text", {
      class: "tile-cohesion",
      x: x0 + LABEL_INDENT,
      y: y0 + 26,
    });
    share.textContent = cohesion === null ? "no data" : formatPercent(cohesion);
    const change = create("text", {
      class: "tile-change",
      x: x0 + LABEL_INDENT,
      y: y0 + 26,
    });
    const delta = leafScoreDelta(leaf);
    change.textContent =
      delta === null ? unchangedText(leaf) : formatScoreChange(delta);
    tile.append(score, share, change);
  }
  return tile;
};
