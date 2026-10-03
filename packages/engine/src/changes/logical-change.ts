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
  /**
   * How much the change counts for its age: the weight (see `recencyWeight`) of
   * its newest commit, since a change lands when its last commit does and a
   * pull request merged yesterday is recent work however long its branch lived.
   * 1 for every change when weighting is off.
   */
  readonly weight: number;
};
