// Owns turning `--since` input into the absolute analysis window.
import { DateTime, Effect, Option, Schema } from "effect";

/** `since` is neither `<n>d|w|m|y` nor an ISO date (`YYYY-MM-DD`), or it is not a representable date in the past. */
export class InvalidSince extends Schema.TaggedError<InvalidSince>()(
  "InvalidSince",
  { input: Schema.String },
) {}

/** The time range of an analysis as ISO 8601 UTC timestamps. */
export type TimeRange = { readonly since: string; readonly until: string };

const RELATIVE = /^([1-9]\d*)([dwmy])$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

const COUNT_BACK: Readonly<
  Record<string, (now: DateTime.Utc, amount: number) => DateTime.Utc>
> = {
  d: (now, days) => DateTime.subtract(now, { days }),
  w: (now, weeks) => DateTime.subtract(now, { weeks }),
  m: (now, months) => DateTime.subtract(now, { months }),
  y: (now, years) => DateTime.subtract(now, { years }),
};

const parseRelative = (
  since: string,
  now: DateTime.Utc,
): Option.Option<DateTime.Utc> => {
  const [, amount = "", unit = ""] = RELATIVE.exec(since) ?? [];
  const countBack = COUNT_BACK[unit];
  return countBack === undefined
    ? Option.none()
    : Option.some(countBack(now, Number(amount)));
};

// A date that rolled over (2026-02-30 becoming March 2) no longer formats to its input.
const parseIsoDate = (since: string): Option.Option<DateTime.Utc> =>
  ISO_DATE.test(since)
    ? Option.filter(DateTime.make(since), (date) =>
        DateTime.formatIso(date).startsWith(since),
      )
    : Option.none();

// Counting back far enough leaves the range of JavaScript dates, which yields an invalid date.
const isUsableStart = (start: DateTime.Utc, now: DateTime.Utc): boolean =>
  Number.isFinite(DateTime.toEpochMillis(start)) &&
  !DateTime.isGreaterThan(start, now);

/**
 * Resolves `since` to a range ending at the current `Clock` time.
 *
 * `<n>d|w|m|y` counts back n days, weeks, calendar months, or calendar years
 * from now; an ISO date starts at midnight UTC of that day. A start after now
 * or beyond the dates JavaScript can represent is invalid.
 */
export const resolveTimeRange = (
  since: string,
): Effect.Effect<TimeRange, InvalidSince> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    const start = Option.filter(
      Option.orElse(parseRelative(since, now), () => parseIsoDate(since)),
      (date) => isUsableStart(date, now),
    );
    if (Option.isNone(start)) {
      return yield* new InvalidSince({ input: since });
    }
    return {
      since: DateTime.formatIso(start.value),
      until: DateTime.formatIso(now),
    };
  });
