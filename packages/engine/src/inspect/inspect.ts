// Owns focus: answering questions about some files within an unchanged universe.
// Pure over a finished Report, so agents' per-file questions cost no second analysis.
// Patterns are repository-relative picomatch globs or exact paths.
import { Order } from "effect";

import { groupByPath, partnersOf } from "../coupling/partners.js";
import type { CopyFamily } from "../report/copy-family.js";
import type { InspectResult } from "../report/inspect-result.js";
import type { Coupling, FileStats, Report } from "../report/report.js";
import { matchesAny } from "../universe/globs.js";

const MAX_PARTNERS = 10;

type Entry = InspectResult["matches"][number];

const toEntry = (
  file: FileStats,
  universeSize: number,
  couplings: ReadonlyArray<Coupling>,
  families: ReadonlyArray<CopyFamily>,
): Entry => ({
  ...file,
  of: universeSize,
  partners: partnersOf(file.path, file.changes, couplings).slice(
    0,
    MAX_PARTNERS,
  ),
  copyFamily: families.find(({ files }) => files.includes(file.path)) ?? null,
});

/**
 * Reports the files matching `patterns`, each with its rank in the whole
 * universe, its strongest co-change partners and its copy family, and the
 * modules they belong to.
 *
 * `report` must be unlimited (as `analyze` returns it); a truncated report
 * would drop matches and partners.
 */
export const inspect = (
  report: Report,
  patterns: ReadonlyArray<string>,
): InspectResult => {
  const focused = new Set<string>();
  const contractFiles = new Set<string>();
  const unmatched: Array<string> = [];
  for (const pattern of patterns) {
    const matches = matchesAny([pattern]);
    const hits = report.files.filter((file) => matches(file.path));
    const contractHits = report.contracts.filter((file) => matches(file.path));
    if (hits.length === 0 && contractHits.length === 0) {
      unmatched.push(pattern);
    }
    for (const { path } of hits) {
      focused.add(path);
    }
    for (const { path } of contractHits) {
      contractFiles.add(path);
    }
  }
  const coupled = groupByPath(report.couplings);
  const matches = report.files
    .filter((file) => focused.has(file.path))
    .toSorted((a, b) => a.rank - b.rank);
  const focusedModules = new Set(matches.map((file) => file.module));
  return {
    schemaVersion: 1,
    window: report.window,
    matches: matches.map((file) =>
      toEntry(
        file,
        report.totals.files,
        coupled.get(file.path) ?? [],
        report.copyFamilies,
      ),
    ),
    modules: report.modules.filter(({ path }) => focusedModules.has(path)),
    contractFiles: [...contractFiles].toSorted((a, b) => Order.String(a, b)),
    unmatched,
  };
};
