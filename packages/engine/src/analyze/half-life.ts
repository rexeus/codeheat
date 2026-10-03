// Owns turning `--half-life` input into the half-life of a change's weight, in days.
import { Effect, Option, Schema } from "effect";

/** The half-life an analysis uses when none is given. */
export const DEFAULT_HALF_LIFE = "6m";

/** `halfLife` is neither `0` nor `<n>d|w|m|y`, or it is too long to count in days. */
export class InvalidHalfLife extends Schema.TaggedError<InvalidHalfLife>()(
  "InvalidHalfLife",
  { input: Schema.String },
) {}

const DURATION = /^([1-9]\d*)([dwmy])$/u;

// A month is 30 days and a year 365: the half-life is a rate of decay, not a calendar date.
const DAYS_PER_UNIT: Readonly<Record<string, number>> = {
  d: 1,
  w: 7,
  m: 30,
  y: 365,
};

const parseDays = (input: string): Option.Option<number> => {
  if (input === "0") {
    return Option.some(0);
  }
  const [, amount = "", unit = ""] = DURATION.exec(input) ?? [];
  const days = Number(amount) * (DAYS_PER_UNIT[unit] ?? Number.NaN);
  return Number.isSafeInteger(days) ? Option.some(days) : Option.none();
};

/**
 * Resolves `halfLife` to days: `<n>d|w|m|y` counts a week as 7 days, a month as
 * 30, and a year as 365; `0` turns weighting off and resolves to 0.
 */
export const resolveHalfLife = (
  halfLife: string,
): Effect.Effect<number, InvalidHalfLife> =>
  Effect.fromOption(
    parseDays(halfLife),
    () => new InvalidHalfLife({ input: halfLife }),
  );
