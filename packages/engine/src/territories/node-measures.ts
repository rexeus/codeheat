// Owns what the evidence says about each territory: its files, its changes,
// and its share of the heat.

/** The part of a code file's report entry that the territories measure. */
export type TerritoryFile = {
  readonly path: string;
  readonly loc: number;
  readonly complexity: { readonly total: number };
  /** Logical changes of the window that touched the file (see `FileStats.changes`). */
  readonly changes: number;
  /** The file is test code (see `FileStats.test`). */
  readonly test: boolean;
};

export type NodeMeasure = {
  readonly files: number;
  readonly testFiles: number;
  /** Counted changes that touched any file of the node. */
  readonly changes: number;
  /** The sum of the heat of its files: `changes × (loc + complexity)`. */
  readonly heat: number;
};

/** The node and all its ancestors, `index` first. */
const lineage = (
  index: number,
  parents: ReadonlyArray<number | null>,
): ReadonlyArray<number> => {
  const chain: Array<number> = [];
  for (let at: number | null = index; at !== null; at = parents[at] ?? null) {
    chain.push(at);
  }
  return chain;
};

/** The nodes that hold any of `paths`: each file's leaf and everything above it. */
const nodesHolding = (
  paths: Iterable<string>,
  leafOf: ReadonlyMap<string, number>,
  parents: ReadonlyArray<number | null>,
): ReadonlySet<number> => {
  const held = new Set<number>();
  for (const path of paths) {
    const leaf = leafOf.get(path);
    for (const index of leaf === undefined ? [] : lineage(leaf, parents)) {
      if (held.has(index)) {
        break;
      }
      held.add(index);
    }
  }
  return held;
};

/** A node no file belongs to. */
export const NO_MEASURE: NodeMeasure = {
  files: 0,
  testFiles: 0,
  changes: 0,
  heat: 0,
};

type Counting = { -readonly [Key in keyof NodeMeasure]: NodeMeasure[Key] };

const update = (
  measures: ReadonlyArray<Counting>,
  nodes: Iterable<number>,
  change: (measure: Counting) => void,
): void => {
  for (const index of nodes) {
    const measure = measures[index];
    if (measure !== undefined) {
      change(measure);
    }
  }
};

/**
 * Measures every node. `leafOf` says which node each file's territory is (the
 * finest one); a node counts its own files and those of all nodes below it.
 * `changes` are the counted changes as the paths of the files they touched;
 * a path with no leaf (a contract file) counts for no node.
 */
export const measureNodes = (
  parents: ReadonlyArray<number | null>,
  leafOf: ReadonlyMap<string, number>,
  files: ReadonlyArray<TerritoryFile>,
  changes: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<NodeMeasure> => {
  const measures: Array<Counting> = parents.map(() => ({ ...NO_MEASURE }));
  for (const file of files) {
    update(measures, nodesHolding([file.path], leafOf, parents), (measure) => {
      measure.files += 1;
      measure.testFiles += file.test ? 1 : 0;
      measure.heat += file.changes * (file.loc + file.complexity.total);
    });
  }
  for (const paths of changes) {
    update(measures, nodesHolding(paths, leafOf, parents), (measure) => {
      measure.changes += 1;
    });
  }
  return measures;
};
