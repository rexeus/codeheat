import type { Report } from "@codeheat/engine";

/**
 * Applies `--limit` to a report: `files` and `couplings` are each cut to
 * their first `limit` entries, `0` keeps everything, and `totals` still
 * describe the untruncated sizes.
 */
export const limitReport = (report: Report, limit: number): Report =>
  limit === 0
    ? report
    : {
        ...report,
        files: report.files.slice(0, limit),
        couplings: report.couplings.slice(0, limit),
      };
