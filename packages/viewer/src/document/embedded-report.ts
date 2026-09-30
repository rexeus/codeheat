import type { Report } from "@codeheat/engine";

/** The `id` of the JSON script element that carries the report. */
export const REPORT_ELEMENT_ID = "report";

const LESS_THAN_ESCAPE = "\\u003c";

/**
 * The report as JSON that is safe inside a `<script>` element: every less-than
 * sign is escaped, so no file name can close the element or open a comment.
 * `JSON.parse` restores the original text.
 */
export const serializeReport = (report: Report): string =>
  JSON.stringify(report).replaceAll("<", LESS_THAN_ESCAPE);

const isReport = (value: unknown): value is Report =>
  typeof value === "object" &&
  value !== null &&
  "schemaVersion" in value &&
  value.schemaVersion === 1 &&
  "files" in value &&
  Array.isArray(value.files) &&
  "couplings" in value &&
  Array.isArray(value.couplings);

/**
 * Reads a report written by `serializeReport`. The page embeds a report the
 * engine already decoded, so this only rejects a document of the wrong kind or
 * schema version instead of rendering garbage.
 */
export const parseReport = (json: string): Report => {
  const value: unknown = JSON.parse(json);
  if (!isReport(value)) {
    throw new TypeError(
      "The embedded document is not a codeheat report (schemaVersion 1).",
    );
  }
  return value;
};
