import type { Analysis } from "@codeheat/engine";

/** The `id` of the JSON script element that carries the report. */
export const REPORT_ELEMENT_ID = "report";

const LESS_THAN_ESCAPE = "\\u003c";

/**
 * The report as JSON that is safe inside a `<script>` element: every less-than
 * sign is escaped, so no file name can close the element or open a comment.
 * `JSON.parse` restores the original text.
 */
export const serializeReport = (report: Analysis): string =>
  JSON.stringify(report).replaceAll("<", LESS_THAN_ESCAPE);

const isReport = (value: unknown): value is Analysis =>
  typeof value === "object" &&
  value !== null &&
  "schemaVersion" in value &&
  value.schemaVersion === 1 &&
  "files" in value &&
  Array.isArray(value.files) &&
  "couplings" in value &&
  Array.isArray(value.couplings);

/**
 * What a report written before the design-fit fields existed lacks: the page
 * renders these as "no data" instead of failing on a missing field. A report
 * from before the verdict judged nothing: its default reason,
 * `no-territories`, which the engine gives only without territories, tells
 * the page to say so when the report has territories (see `describeVerdict`).
 */
const DESIGN_FIT_DEFAULTS = {
  verdict: {
    level: "unknown",
    reason: "no-territories",
    leakShare: 0,
    coverage: 0,
    judged: [],
    leaking: [],
    eroding: false,
    trend: "unknown",
  },
  territories: { recommended: 0, details: [], nodes: [] },
  territoryCoupling: [],
  territoryCliques: [],
  entryPoints: [],
  changeRadius: null,
  propagationCost: null,
  erosion: null,
} satisfies Partial<Analysis>;

/** The limits a report from before the territory matrix lacks. */
const OLDER_THRESHOLDS = { maxCoupledTerritories: 24 } satisfies Partial<
  Analysis["thresholds"]
>;

/**
 * Reads a report written by `serializeReport`. The page embeds a report the
 * engine already decoded, so this only rejects a document of the wrong kind or
 * schema version instead of rendering garbage. A report from an older codeheat
 * gets empty design-fit fields and the limits it lacks.
 */
export const parseReport = (json: string): Analysis => {
  const value: unknown = JSON.parse(json);
  if (!isReport(value)) {
    throw new TypeError(
      "The embedded document is not a codeheat report (schemaVersion 1).",
    );
  }
  return {
    ...DESIGN_FIT_DEFAULTS,
    ...value,
    thresholds: { ...OLDER_THRESHOLDS, ...value.thresholds },
  };
};
