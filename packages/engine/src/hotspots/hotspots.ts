// Owns hotspot scoring: where change frequency and complexity meet.
import { Order } from "effect";

import { groupByPath, partnersOf } from "../coupling/partners.js";
import type { Complexity } from "../metrics/complexity.js";
import { roundReported } from "../report/precision.js";
import type { Coupling, FileStats } from "../report/report.js";
import { describeFile, isHubCandidate } from "./reasons.js";

/** What is known about one universe file before it is scored. */
export type FileMeasure = {
  readonly path: string;
  /** `path` of the file's module. */
  readonly module: string;
  readonly revisions: number;
  readonly linesAdded: number;
  readonly linesDeleted: number;
  readonly complexity: Complexity;
  /** Distinct other universe files changed together with this one. */
  readonly breadth: number;
  /** Set for an entry point of a module whose interface leaks: the module's leakage. */
  readonly interfaceLeakage?: number | undefined;
};

/** `log(1 + value) / log(1 + max)`: 0..1, compressing outliers so one giant file does not flatten the rest. */
const logNormalizer =
  (max: number) =>
  (value: number): number =>
    max === 0 ? 0 : Math.log1p(value) / Math.log1p(max);

const maximum = (values: ReadonlyArray<number>): number =>
  values.reduce((largest, value) => Math.max(largest, value), 0);

/**
 * The size a file's score weighs: every non-blank line counts 1 plus its
 * nesting depth. Indentation alone would score flat files such as barrels 0,
 * however often they change; lines alone would ignore nesting.
 */
const weightedLines = (complexity: Complexity): number =>
  complexity.loc + complexity.total;

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

/** Ranks hub candidates by breadth; a file that is no candidate has no rank. */
const hubRanking = (measures: ReadonlyArray<FileMeasure>) => {
  const candidates = measures.filter((m) =>
    isHubCandidate(m.path, m.revisions),
  );
  const ranks = competitionRanks(candidates.map((m) => m.breadth));
  return {
    candidates: candidates.length,
    rankOf: ({ path, revisions, breadth }: FileMeasure): number | undefined =>
      isHubCandidate(path, revisions) ? ranks.get(breadth) : undefined,
  };
};

/** Normalized revisions × normalized weighted lines, each against the largest among `measures`. */
const scorer = (measures: ReadonlyArray<FileMeasure>) => {
  const normalizeRevisions = logNormalizer(
    maximum(measures.map((m) => m.revisions)),
  );
  const normalizeWeight = logNormalizer(
    maximum(measures.map((m) => weightedLines(m.complexity))),
  );
  return (measure: FileMeasure): number =>
    normalizeRevisions(measure.revisions) *
    normalizeWeight(weightedLines(measure.complexity));
};

/**
 * Scores every file as normalized revisions × normalized weighted lines, and
 * returns them best first; equal scores order by path.
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
  const hubs = hubRanking(measures);
  const scoreOf = scorer(measures);
  const coupled = groupByPath(couplings);

  return measures
    .map((measure) => ({ measure, score: scoreOf(measure) }))
    .toSorted(
      (a, b) =>
        b.score - a.score || Order.String(a.measure.path, b.measure.path),
    )
    .map(({ measure, score }, index): FileStats => {
      const { path, revisions, complexity, breadth } = measure;
      return {
        path,
        module: measure.module,
        rank: index + 1,
        score: roundReported(score),
        revisions,
        linesAdded: measure.linesAdded,
        linesDeleted: measure.linesDeleted,
        loc: complexity.loc,
        breadth,
        complexity: {
          total: complexity.total,
          mean: roundReported(complexity.mean),
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
          breadth,
          breadthRank: hubs.rankOf(measure),
          candidates: hubs.candidates,
          interfaceLeakage: measure.interfaceLeakage,
        }),
        trend: null,
      };
    });
};
