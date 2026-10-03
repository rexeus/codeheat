// Owns the terminal view of how far a change spreads: the change radius and the propagation cost.
import type { Module, Report } from "@codeheat/engine";

import { percent } from "./format.js";

/** `1 module`, `3 modules`. */
const moduleCount = (count: number): string =>
  `${count} ${count === 1 ? "module" : "modules"}`;

/** A share of the files as a percentage; one decimal below 10% so that a small cost stays visible, and `<0.1%` rather than 0% for a cost above 0. */
const costShare = (cost: number): string => {
  if (cost >= 0.1) {
    return percent(cost);
  }
  const tenths = Math.round(cost * 1000) / 10;
  return tenths === 0 && cost > 0 ? "<0.1%" : `${tenths}%`;
};

/**
 * Two sentences on how far a change spreads: the modules a typical change
 * touches, how many nine in ten touch at most, and how many stay in one
 * module; and the share of the other files a change to one file reaches
 * through chains of couplings. A sentence is left out when the report has no
 * such number.
 */
export const spreadLines = ({
  changeRadius,
  propagationCost,
  thresholds,
}: Pick<Report, "changeRadius" | "propagationCost"> & {
  readonly thresholds: Pick<Report["thresholds"], "propagationDepth">;
}): ReadonlyArray<string> => [
  ...(changeRadius === null
    ? []
    : [
        `A typical change touches ${moduleCount(changeRadius.median)}; 9 in 10 touch at most ${moduleCount(changeRadius.p90)}; ${percent(changeRadius.local)} stay in one module.`,
      ]),
  ...(propagationCost === null
    ? []
    : [
        `Propagation cost ${costShare(propagationCost.cost)}: a change to one file reaches that share of the other files within ${thresholds.propagationDepth} couplings.`,
      ]),
];

/** What a module's radius says on one line: nothing for a module without one. */
export const radiusClause = ({ radius }: Pick<Module, "radius">): string =>
  radius === null
    ? ""
    : `; a typical change touching it touches ${moduleCount(radius)}`;
