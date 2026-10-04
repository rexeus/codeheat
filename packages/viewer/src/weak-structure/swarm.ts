/** A dot to place on a line: its center along the line and its radius, in pixels. */
export type Dot = { readonly x: number; readonly r: number };

/** A placed dot: `y` is its offset from the line, in pixels, up negative. */
export type PlacedDot = Dot & { readonly y: number };

/** Space kept between two dots, in pixels. */
const GAP = 1;
/** How far a dot moves away from the line per try, in pixels. */
const STEP = 5;
/** How many places off the line a dot tries before it overlaps anyway. */
const MAX_TRIES = 40;

const overlaps = (dot: Dot, y: number, placed: readonly PlacedDot[]): boolean =>
  placed.some(
    (other) => Math.hypot(other.x - dot.x, other.y - y) < other.r + dot.r + GAP,
  );

/** The offsets a dot tries in turn: on the line, then one step up, one down, two up, and so on. */
const offset = (attempt: number): number =>
  (attempt % 2 === 1 ? -1 : 1) * Math.ceil(attempt / 2) * STEP;

/**
 * Places `dots` along a line in the order given, each as close to the line as
 * it fits without touching a dot placed before it: a beeswarm. Give the
 * largest first to keep them near the line.
 */
export const swarmOf = (dots: readonly Dot[]): PlacedDot[] => {
  const placed: PlacedDot[] = [];
  for (const dot of dots) {
    let attempt = 0;
    while (attempt < MAX_TRIES && overlaps(dot, offset(attempt), placed)) {
      attempt += 1;
    }
    placed.push({ ...dot, y: offset(attempt) });
  }
  return placed;
};
