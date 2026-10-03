// Owns what coupling, cohesion, and interface churn count: a logical change.

/**
 * A real change to the universe, the unit that coupling, module cohesion, and
 * interface churn count: one commit, or the commits that belong together.
 */
export type LogicalChange = {
  /**
   * The distinct ids of the files whose current file the change touched; none
   * when it only touched earlier files that lived at a universe path.
   */
  readonly files: Uint32Array;
  /**
   * How many distinct universe files it touched, earlier ones included: the
   * size that decides whether a change is too large to count. It never
   * shrinks for files that are dead today.
   */
  readonly size: number;
};
