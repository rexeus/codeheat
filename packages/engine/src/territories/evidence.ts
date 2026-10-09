// Owns what the counted changes and the files' heat say about the files that
// shape the territory tree.
import type { TerritoryFile } from "./node-measures.js";
import type { Evidence } from "./part.js";

/** A territory's changes say nothing below this many, however low the threshold of ranked modules. */
const MIN_CHANGES = 8;
/** The size bound of a territory: a quarter of the files, within these limits. */
const MIN_SIZE_BOUND = 50;
const MAX_SIZE_BOUND = 150;

/** What the evidence is made from. */
export type EvidenceInput = {
  /** The code files of the universe, test code left out. */
  readonly files: ReadonlyArray<TerritoryFile>;
  /** The counted changes, each as the paths of the files it touched (contract files included). */
  readonly changes: ReadonlyArray<ReadonlyArray<string>>;
  /** `Thresholds.minModuleCommits`. */
  readonly minChanges: number;
};

const heatOfFile = (file: TerritoryFile): number =>
  file.changes * (file.loc + file.complexity.total);

/**
 * The counted changes as the files that shape the tree (contract files left
 * out), and the heat those files carry.
 */
export const evidenceOf = ({
  files,
  changes,
  minChanges,
}: EvidenceInput): Evidence => {
  const heat = new Map(files.map((file) => [file.path, heatOfFile(file)]));
  const touched = changes
    .map((paths) => paths.filter((path) => heat.has(path)))
    .filter((touchedFiles) => touchedFiles.length > 0);
  const byFile = new Map<string, Array<number>>();
  for (const [index, touchedFiles] of touched.entries()) {
    for (const file of touchedFiles) {
      const indices = byFile.get(file) ?? [];
      indices.push(index);
      byFile.set(file, indices);
    }
  }
  const total = files.length;
  return {
    total,
    changeCount: touched.length,
    byFile,
    changes: touched,
    minChanges: Math.max(MIN_CHANGES, minChanges),
    sizeBound: Math.min(
      MAX_SIZE_BOUND,
      Math.max(MIN_SIZE_BOUND, Math.floor(total / 4)),
    ),
    heat,
    totalHeat: [...heat.values()].reduce((sum, own) => sum + own, 0),
  };
};
