import type { Report } from "@codeheat/engine";

/**
 * Applies `--limit` to a report: `files`, `contracts`, `couplings`,
 * `modules`, `copyFamilies`, and `distantCouplings`, `moduleCoupling`, `cliques`, `unstableInterfaces`, and `dependencyDirection` are each cut to their first `limit` entries,
 * `0` keeps everything, and `totals` still
 * describe the untruncated sizes. `entryPoints` is never cut (it has ten at most) and neither is `territories`: a tree without
 * some of its nodes would not hold together. `territoryCoupling` (at most 276 pairs) and `territoryCliques` stay whole as well: they are the
 * data of one picture and name territories the tree holds.
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
        moduleCoupling: report.moduleCoupling.slice(0, limit),
        cliques: report.cliques.slice(0, limit),
        unstableInterfaces: report.unstableInterfaces.slice(0, limit),
        dependencyDirection: report.dependencyDirection.slice(0, limit),
      };
