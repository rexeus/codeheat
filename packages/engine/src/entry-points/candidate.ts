// Owns what every kind of entry point produces before the list is ranked.
import type { EntryPoint } from "../report/entry-point.js";
import { roundReported } from "../report/precision.js";

/** An entry point that waits to be ranked; `score` is exact. */
export type Candidate = Omit<EntryPoint, "rank">;

/** The evidence with the numbers that do not exist left out, rounded as the report rounds. */
export const evidenceOf = (
  numbers: Readonly<Record<string, number | null | undefined>>,
): Readonly<Record<string, number>> =>
  Object.fromEntries(
    Object.entries(numbers).flatMap(([name, value]) =>
      value === null || value === undefined
        ? []
        : [[name, roundReported(value)]],
    ),
  );
