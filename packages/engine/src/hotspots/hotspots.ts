// Owns hotspot scoring: where change frequency and complexity meet.
import { Order } from "effect";

import { groupByPath, partnersOf } from "../coupling/partners.js";
import type { Complexity } from "../metrics/complexity.js";
import type { Coupling, FileStats } from "../report/report.js";
import { describeFile } from "./reasons.js";

/** What is known about one universe file before it is scored. */
export type FileMeasure = {
  readonly path: string;
  readonly revisions: number;
  readonly linesAdded: number;
  readonly linesDeleted: number;
  readonly complexity: Complexity;
};

/** `log(1 + value) / log(1 + max)`: 0..1, compressing outliers so one giant file does not flatten the rest. */
const logNormalizer =
  (max: number) =>
  (value: number): number =>
    max === 0 ? 0 : Math.log1p(value) / Math.log1p(max);

const maximum = (values: ReadonlyArray<number>): number =>
  values.reduce((largest, value) => Math.max(largest, value), 0);

/** Maps each value to 1 + the number of larger values, so equal values share a rank. */
const competitionRanks = (
  values: ReadonlyArray<number>,
): ReadonlyMap<number, number> => {
  const ranks = new Map<number, number>();
  for (const [index, value] of values.toSorted((a, b) => b - a).entries()) {
    if (!ranks.has(value)) {
      ranks.set(value, index + 1);
    }
  }
  return ranks;
};

/**
 * Scores every file as normalized revisions × normalized indentation
 * complexity, and returns them best first; equal scores order by path.
 *
 * `couplings` feeds each file's co-change reason.
 */
export const rankFiles = (
  measures: ReadonlyArray<FileMeasure>,
  couplings: ReadonlyArray<Coupling>,
): ReadonlyArray<FileStats> => {
  const revisionRanks = competitionRanks(measures.map((m) => m.revisions));
  const complexityRanks = competitionRanks(
    measures.map((m) => m.complexity.total),
  );
  const normalizeRevisions = logNormalizer(
    maximum(measures.map((m) => m.revisions)),
  );
  const normalizeComplexity = logNormalizer(
    maximum(measures.map((m) => m.complexity.total)),
  );
  const coupled = groupByPath(couplings);

  return measures
    .map((measure) => ({
      measure,
      score:
        normalizeRevisions(measure.revisions) *
        normalizeComplexity(measure.complexity.total),
    }))
    .toSorted(
      (a, b) =>
        b.score - a.score || Order.String(a.measure.path, b.measure.path),
    )
    .map(({ measure, score }, index): FileStats => {
      const { path, revisions, complexity } = measure;
      return {
        path,
        rank: index + 1,
        score,
        revisions,
        linesAdded: measure.linesAdded,
        linesDeleted: measure.linesDeleted,
        loc: complexity.loc,
        complexity: {
          total: complexity.total,
          mean: complexity.mean,
          max: complexity.max,
        },
        reasons: describeFile({
          revisions,
          revisionRank: revisionRanks.get(revisions) ?? measures.length,
          complexity: complexity.total,
          complexityRank:
            complexityRanks.get(complexity.total) ?? measures.length,
          of: measures.length,
          partners: partnersOf(path, revisions, coupled.get(path) ?? []),
        }),
      };
    });
};
