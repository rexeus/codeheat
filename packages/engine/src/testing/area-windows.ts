// Tests only: series windows as the areas each counted change touched.

/**
 * One window per share, oldest first, of `changes` counted changes that each
 * touch `area`: the first `share × changes` (rounded) touch nothing else, the
 * rest also touch an area named `elsewhere`, so `area` keeps that share of its
 * changes inside.
 */
export const windowsStaying = (
  shares: ReadonlyArray<number>,
  { area = "t1", changes = 40 }: { area?: string; changes?: number } = {},
): ReadonlyArray<ReadonlyArray<ReadonlySet<string>>> =>
  shares.map((share) =>
    Array.from(
      { length: changes },
      (_, index) =>
        new Set(
          index < Math.round(share * changes) ? [area] : [area, "elsewhere"],
        ),
    ),
  );
