// Owns disjoint sets of indexes, the way commits are joined into groups.

/** Disjoint sets of the indexes `0..size-1`, each index alone to begin with. */
export class Partition {
  readonly #parent: Int32Array;

  constructor(size: number) {
    this.#parent = Int32Array.from({ length: size }, (_, index) => index);
  }

  /** The index that stands for the set of `index`. */
  rootOf(index: number): number {
    let root = index;
    while (this.#parent[root] !== root) {
      root = this.#parent[root] ?? root;
    }
    return root;
  }

  /** Joins the sets of the two indexes. */
  join(first: number, second: number): void {
    this.#parent[this.rootOf(second)] = this.rootOf(first);
  }

  /** Joins the indexes of each group into one set. */
  joinAll(groups: ReadonlyArray<ReadonlyArray<number>>): void {
    for (const [first = 0, ...rest] of groups) {
      for (const other of rest) {
        this.join(first, other);
      }
    }
  }

  /** The members of each set in index order, the sets in order of their first member. */
  sets(): ReadonlyArray<ReadonlyArray<number>> {
    const sets = new Map<number, Array<number>>();
    for (let index = 0; index < this.#parent.length; index += 1) {
      const root = this.rootOf(index);
      const members = sets.get(root) ?? [];
      members.push(index);
      sets.set(root, members);
    }
    return [...sets.values()];
  }
}
