// Owns how much a commit weighs by its age: recent commits count more.

const SECONDS_PER_DAY = 86_400;
// Three changes' worth of prior: how much the plain ratio counts against the weighted one.
const PRIOR_COMMITS = 3;
// Far below any weight that matters, far above underflow: ratios of ancient weights stay defined.
const SMALLEST_WEIGHT = 1e-300;

/**
 * The weight of a commit that happened `ageSeconds` before the end of its
 * window: `0.5^(age / halfLife)`, so it halves with every half-life that has
 * passed. A `halfLifeDays` of 0 turns weighting off: every commit weighs 1.
 * A commit after the end of the window (clock skew) weighs like one at the end.
 * The weight never falls below a tiny floor, so sums of ancient weights stay
 * positive and their ratios (a coupling degree, a cohesion) stay defined.
 */
const recencyWeight = (ageSeconds: number, halfLifeDays: number): number =>
  halfLifeDays === 0
    ? 1
    : Math.max(
        SMALLEST_WEIGHT,
        0.5 ** (Math.max(0, ageSeconds) / (halfLifeDays * SECONDS_PER_DAY)),
      );

/** Where a window ends and how fast a commit loses weight before that. */
export type Recency = {
  /** Seconds since the epoch. */
  readonly windowEnd: number;
  readonly halfLifeDays: number;
};

/** The weight of a commit made at `time`, in seconds since the epoch, in a window with this recency. */
export const weightAt = (time: number, recency: Recency): number =>
  recencyWeight(recency.windowEnd - time, recency.halfLifeDays);

/** A count of commits or changes and the same ones weighed by age. */
export type Tally = {
  readonly plain: number;
  readonly weighted: number;
};

/**
 * A share measured by weight, `part.weighted / whole.weighted`, pulled towards
 * the plain share `part.plain / whole.plain` of the same changes by a prior
 * worth three changes: `(part.weighted + 3 × plainShare) / (whole.weighted +
 * 3)`. Where the recent evidence amounts to a few changes (the whole weighs
 * about 3 or less), one recent change cannot swing a share built on many old
 * ones to 0 or 1; where it amounts to many, the weighted share prevails. When
 * the whole weighs what it counts, every change weighs 1 (weighting is off):
 * the result is then the plain quotient itself, not a float that merely
 * rounds near it.
 */
export const shrunkShare = (part: Tally, whole: Tally): number => {
  const plainShare = part.plain / whole.plain;
  return whole.weighted === whole.plain
    ? plainShare
    : (part.weighted + PRIOR_COMMITS * plainShare) /
        (whole.weighted + PRIOR_COMMITS);
};
