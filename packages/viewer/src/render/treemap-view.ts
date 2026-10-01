import type { PlacedLeaf, Size, TreemapLayout } from "../layout/treemap.js";
import type { Highlight, Selection } from "../selection/highlight.js";
import { svgFactory } from "./dom.js";
import type { SvgFactory } from "./dom.js";
import { drawOutlines } from "./outlines.js";
import { NO_DATA_PATTERN, drawGroup, drawLeaf } from "./tiles.js";
import type { TileColors } from "./tiles.js";

/** What the treemap reports back to the page. */
export type TreemapHandlers = {
  /** The pointer is over `leaf`, or over no tile when `null`. */
  readonly hover: (leaf: PlacedLeaf | null, event: PointerEvent) => void;
  /** A file tile was clicked; `null` means the background was clicked. */
  readonly select: (path: string | null) => void;
};

/** The SVG treemap: `draw` places tiles, `paint` restyles them without moving anything. */
export type TreemapView = {
  readonly draw: (layout: TreemapLayout, size: Size) => void;
  readonly paint: (
    highlightOf: (leaf: PlacedLeaf) => Highlight,
    selection: Selection | null,
  ) => void;
};

/** The diagonal hatch of tiles that have no change to show. */
const noDataPattern = (create: SvgFactory): SVGElement => {
  const pattern = create("pattern", {
    id: NO_DATA_PATTERN,
    width: 5,
    height: 5,
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(45)",
  });
  pattern.append(
    create("line", { class: "hatch-line", x1: 0, y1: 0, x2: 0, y2: 5 }),
  );
  const defs = create("defs");
  defs.append(pattern);
  return defs;
};

export const createTreemapView = (
  svg: SVGSVGElement,
  colors: TileColors,
  handlers: TreemapHandlers,
): TreemapView => {
  const create = svgFactory(svg);
  let leaves: readonly PlacedLeaf[] = [];
  let tiles: readonly SVGElement[] = [];
  let overlay = create("g", { class: "overlay" });

  const tileAt = (event: Event): PlacedLeaf | null => {
    const target =
      event.target instanceof Element ? event.target.closest(".tile") : null;
    const index =
      target instanceof SVGElement ? target.dataset["index"] : undefined;
    return index === undefined ? null : (leaves[Number(index)] ?? null);
  };

  svg.addEventListener("pointermove", (event) => {
    handlers.hover(tileAt(event), event);
  });
  svg.addEventListener("pointerleave", (event) => {
    handlers.hover(null, event);
  });
  svg.addEventListener("click", (event) => {
    const leaf = tileAt(event);
    if (leaf === null) {
      handlers.select(null);
    } else if (leaf.node.kind === "file") {
      handlers.select(leaf.node.path);
    }
  });

  return {
    draw: (layout, { width, height }) => {
      leaves = layout.leaves;
      tiles = leaves.map((leaf, index) =>
        drawLeaf(create, leaf, index, colors),
      );
      overlay = create("g", { class: "overlay" });
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.replaceChildren(
        noDataPattern(create),
        ...layout.groups.flatMap((group) => drawGroup(create, group)),
        ...tiles,
        overlay,
      );
    },
    paint: (highlightOf, selection) => {
      for (const [index, leaf] of leaves.entries()) {
        const tile = tiles[index];
        if (tile !== undefined) {
          tile.dataset["highlight"] = highlightOf(leaf);
        }
      }
      overlay.replaceChildren(...drawOutlines(create, leaves, selection));
    },
  };
};
