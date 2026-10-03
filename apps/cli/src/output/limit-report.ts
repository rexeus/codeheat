import type { Report } from "@codeheat/engine";

/**
 * Applies `--limit` to a report: `files`, `contracts`, `couplings`,
 * `modules`, `copyFamilies`, and `distantCouplings` are each cut to their first `limit` entries,
 * `0` keeps everything, and `totals` still
 * describe the untruncated sizes.
 */
export const limitReport = (report: Report, limit: number): Report =>
  limit === 0
    ? report
    : {
        ...report,
        files: report.files.slice(0, limit),
        contracts: report.contracts.slice(0, limit),
        couplings: report.couplings.slice(0, limit),
        modules: report.modules.slice(0, limit),
        copyFamilies: report.copyFamilies.slice(0, limit),
        distantCouplings: report.distantCouplings.slice(0, limit),
      };
