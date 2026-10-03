// Owns which files are the hottest of one window of the series.
import { scoreFiles } from "../hotspots/hotspots.js";
import type { FileMeasure } from "../hotspots/hotspots.js";

/** The share of the files with revisions in a window that are hot in it. */
export const HOT_TOP_SHARE = 0.1;

/**
 * The paths among `measures` (the files of one window that have revisions
 * there; test code is left to the caller) whose score is among the best
 * `HOT_TOP_SHARE` of them, rounded up, ties at the cut-off included. A score
 * of 0 is never hot.
 */
export const hotFiles = (
  measures: ReadonlyArray<
    Pick<FileMeasure, "path" | "revisions" | "complexity">
  >,
): ReadonlySet<string> => {
  const scores = scoreFiles(measures);
  const cutOff = scores
    .toSorted((a, b) => b - a)
    .at(Math.ceil(HOT_TOP_SHARE * measures.length) - 1);
  if (cutOff === undefined || cutOff <= 0) {
    return new Set();
  }
  return new Set(
    measures.flatMap(({ path }, index) =>
      (scores[index] ?? 0) >= cutOff ? [path] : [],
    ),
  );
};
