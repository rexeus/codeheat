// @scaffold Each export is tagged @public until the CLI consumes it in step 2.6;
// @scaffold remove the tags then so knip holds every export to a production caller.
/** @public */
export { analyze } from "./analyze/analyze.js";
/** @public */
export type { AnalyzeError, AnalyzeOptions } from "./analyze/analyze.js";
/** @public */
export { InvalidSince } from "./analyze/analysis-window.js";
/** @public */
export {
  GitCommandFailed,
  GitNotFound,
  NotAGitRepository,
} from "./git/git-errors.js";
/** @public */
export { inspect } from "./inspect/inspect.js";
/** @public */
export { InspectResult } from "./report/inspect-result.js";
/** @public */
export { Report } from "./report/report.js";
/** @public */
export type { Coupling, FileStats } from "./report/report.js";
