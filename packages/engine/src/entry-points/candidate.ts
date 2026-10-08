// Owns what every kind of entry point produces before the list is ranked.
import type { EntryPoint } from "../model/entry-point.js";
import { roundReported } from "../model/precision.js";

/** One finding about an entry point (see `EntryPoint.findings`). */
export type Finding = EntryPoint["findings"][number];

/**
 * One finding about an entry point, with what it concerns, waiting to be
 * ranked; `score` is exact. `parts` are the findings it is made of, which
 * follow its own in `EntryPoint.findings`: the two territories' boundaries of
 * a boundary between both.
 */
export type Candidate = Omit<EntryPoint, "rank" | "findings"> & {
  readonly parts?: ReadonlyArray<Finding>;
};

/** An entry point that waits to be ranked: its findings are merged (see `entriesOf`). */
export type Entry = Omit<EntryPoint, "rank">;

/** The candidate as the finding it is. */
export const findingOf = ({
  kind,
  verdict,
  designMove,
  evidence,
  files,
  territories,
}: Candidate): Finding => ({
  kind,
  verdict,
  designMove,
  evidence,
  files,
  territories,
});

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
