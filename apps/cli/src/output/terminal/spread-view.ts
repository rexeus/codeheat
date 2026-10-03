// Owns the terminal view of how far a change spreads: the change radius.
import type { Module, Report } from "@codeheat/engine";

import { percent } from "./format.js";

/** Fewest measured changes at which nine in ten of them say something. */
const MIN_CHANGES_FOR_P90 = 10;

const moduleCount = (count: number): string =>
  `${count} ${count === 1 ? "module" : "modules"}`;

/**
 * One sentence on how far a change spreads over the measured changes: the
 * modules a typical change touches, how many nine in ten touch at most (left
 * out below ten changes, where it is the maximum), and the share that stays in
 * one module. Nothing when the report has no change radius.
 */
export const spreadLines = ({
  changeRadius,
}: Pick<Report, "changeRadius">): ReadonlyArray<string> => {
  if (changeRadius === null) {
    return [];
  }
  const { changes, median, p90, local } = changeRadius;
  const clauses = [
    `a typical change touches ${moduleCount(median)}`,
    ...(changes >= MIN_CHANGES_FOR_P90
      ? [`9 in 10 touch at most ${moduleCount(p90)}`]
      : []),
    `${percent(local)} stay in one module`,
  ];
  return [
    `Across ${changes} ${changes === 1 ? "change" : "changes"}, ${clauses.join("; ")}.`,
  ];
};

/** What a module's radius says on one line: nothing for a module without one. */
export const radiusClause = ({ radius }: Pick<Module, "radius">): string =>
  radius === null
    ? ""
    : `; a typical change touching it touches ${moduleCount(radius)}`;
