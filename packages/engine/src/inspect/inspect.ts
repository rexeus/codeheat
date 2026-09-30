// Owns focus: answering questions about some files within an unchanged universe.
// Pure over a finished Report, so agents' per-file questions cost no second analysis.
// Patterns are repository-relative picomatch globs or exact paths.
import type { InspectResult } from "../report/inspect-result.js";
import type { Report } from "../report/report.js";

/**
 * Reports the files matching `patterns`, each with its rank in the whole
 * universe and its strongest co-change partners.
 *
 * `report` must be unlimited (as `analyze` returns it); a truncated report
 * would drop matches and partners.
 */
export const inspect = (
  _report: Report,
  _patterns: ReadonlyArray<string>,
): InspectResult => {
  throw new Error("@scaffold not implemented");
};
