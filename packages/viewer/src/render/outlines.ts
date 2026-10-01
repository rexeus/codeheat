import type { PlacedLeaf } from "../layout/treemap.js";
import type { Selection } from "../selection/highlight.js";
import type { Partner } from "../selection/partners.js";
import type { SvgFactory } from "./dom.js";

const SELECTED_WIDTH = 3;
/** Partner outlines grow with the coupling degree: 1.5px to 4.5px. */
const OUTLINE_BASE = 1.5;
const OUTLINE_PER_DEGREE = 3;

const outline = (
  create: SvgFactory,
  { rect }: PlacedLeaf,
  className: string,
  strokeWidth: number,
): SVGElement =>
  create("rect", {
    class: className,
    x: rect.x0,
    y: rect.y0,
    width: rect.x1 - rect.x0,
    height: rect.y1 - rect.y0,
    "stroke-width": strokeWidth,
  });

const lineStyle = ({ crossesModule, testPair }: Partner): string => {
  if (crossesModule) {
    return " cross-module";
  }
  return testPair ? " test-pair" : "";
};

const outlineClass = (partner: Partner): string =>
  `outline partner${lineStyle(partner)}${partner.hidden ? " hidden-coupling" : ""}`;

/**
 * Outline rectangles for the selected file and its partners, drawn above the
 * tiles. A partner's stroke grows with its coupling degree, and a test pair is
 * dashed. A partner in another module is dotted, so cross-module coupling
 * reads at a glance; a test pair that also crosses a module stays dotted. A
 * partner that no import links to the selected file (hidden coupling) takes
 * its own color, whatever its line style.
 * Returns nothing without a selection.
 */
export const drawOutlines = (
  create: SvgFactory,
  leaves: readonly PlacedLeaf[],
  selection: Selection | null,
): SVGElement[] => {
  if (selection === null) {
    return [];
  }
  return leaves.flatMap((leaf) => {
    if (leaf.node.kind !== "file") {
      return [];
    }
    if (leaf.node.path === selection.path) {
      return [outline(create, leaf, "outline selected", SELECTED_WIDTH)];
    }
    const partner = selection.partners.get(leaf.node.path);
    if (partner === undefined) {
      return [];
    }
    const className = outlineClass(partner);
    return [
      outline(
        create,
        leaf,
        className,
        OUTLINE_BASE + OUTLINE_PER_DEGREE * partner.degree,
      ),
    ];
  });
};
