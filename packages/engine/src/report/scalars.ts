// Owns the units of report v2, one rule each, so that a number reads the same
// wherever it appears in the document.
import { Schema } from "effect";

/** A whole number of changes, files, lines, or areas. */
export const Count = Schema.Natural;

/** A ratio from 0 to 1, rounded to 2 decimals. */
export const Share = Schema.Finite.check(
  Schema.isBetween({ minimum: 0, maximum: 1 }),
);

/** A percent of all the change effort (heat) from 0 to 100, rounded to 1 decimal. */
export const Percent = Schema.Finite.check(
  Schema.isBetween({ minimum: 0, maximum: 100 }),
);

/** A day in UTC, `YYYY-MM-DD`. */
export const Day = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u),
);
