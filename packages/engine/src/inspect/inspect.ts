// Owns focus: answering questions about some files within an unchanged universe.
// Pure over a finished Report, so agents' per-file questions cost no second analysis.
// Patterns are repository-relative picomatch globs or exact paths.
import { groupByPath, partnersOf } from "../coupling/partners.js";
import type { InspectResult } from "../report/inspect-result.js";
import type { Coupling, FileStats, Report } from "../report/report.js";
import { matchesAny } from "../universe/globs.js";

const MAX_PARTNERS = 10;

type Entry = InspectResult["matches"][number];

const toEntry = (
  file: FileStats,
  universeSize: number,
  couplings: ReadonlyArray<Coupling>,
): Entry => ({
  ...file,
  of: universeSize,
  partners: partnersOf(file.path, file.revisions, couplings).slice(
    0,
    MAX_PARTNERS,
  ),
});

/**
 * Reports the files matching `patterns`, each with its rank in the whole
 * universe and its strongest co-change partners.
 *
 * `report` must be unlimited (as `analyze` returns it); a truncated report
 * would drop matches and partners.
 */
export const inspect = (
  report: Report,
  patterns: ReadonlyArray<string>,
): InspectResult => {
  const focused = new Set<string>();
  const unmatched: Array<string> = [];
  for (const pattern of patterns) {
    const matches = matchesAny([pattern]);
    const hits = report.files.filter((file) => matches(file.path));
    if (hits.length === 0) {
      unmatched.push(pattern);
    }
    for (const { path } of hits) {
      focused.add(path);
    }
  }
  const coupled = groupByPath(report.couplings);
  return {
    schemaVersion: 1,
    window: report.window,
    matches: report.files
      .filter((file) => focused.has(file.path))
      .toSorted((a, b) => a.rank - b.rank)
      .map((file) =>
        toEntry(file, report.totals.files, coupled.get(file.path) ?? []),
      ),
    unmatched,
  };
};
