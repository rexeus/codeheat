// Owns what the counted changes and the files' heat say about the files that
// shape the territory tree.
import { isTestPath } from "../modules/test-path.js";
import type { TestAttachment } from "./attach-tests.js";
import { ancestorDirectories } from "./folders.js";
import type { TerritoryFile } from "./node-measures.js";
import type { Evidence } from "./part.js";

/** A territory's changes say nothing below this many, however low the threshold of ranked modules. */
const MIN_CHANGES = 8;
/** The size bound of a territory: a quarter of the files, within these limits. */
const MIN_SIZE_BOUND = 50;
const MAX_SIZE_BOUND = 150;

/** What the evidence is made from. */
export type EvidenceInput = {
  /** The code files of the universe. */
  readonly files: ReadonlyArray<TerritoryFile>;
  /** The counted changes, each as the paths of the files it touched (contract files included). */
  readonly changes: ReadonlyArray<ReadonlyArray<string>>;
  /** `Thresholds.minModuleCommits`. */
  readonly minChanges: number;
};

/** The file that shapes the tree for `path`: itself, or the code it is paired with; undefined for other test code. */
const unitOf = (
  path: string,
  units: ReadonlySet<string>,
  attachment: TestAttachment,
): string | undefined =>
  units.has(path) ? path : attachment.pairedWith.get(path);

const heatOfFile = (file: TerritoryFile): number =>
  file.changes * (file.loc + file.complexity.total);

/** The heat of the test code placed in each directory (see `attachTests`). */
const placedHeat = (
  files: ReadonlyArray<TerritoryFile>,
  attachment: TestAttachment,
): ReadonlyMap<string, number> => {
  const heatOfHome = new Map<string, number>();
  for (const file of files) {
    const home = attachment.placedIn.get(file.path);
    if (home !== undefined) {
      heatOfHome.set(home, (heatOfHome.get(home) ?? 0) + heatOfFile(file));
    }
  }
  return heatOfHome;
};

/** The units below each of `directories`. */
const unitsBelow = (
  units: ReadonlyArray<string>,
  directories: ReadonlyMap<string, number>,
): ReadonlyMap<string, ReadonlyArray<string>> => {
  const below = new Map<string, Array<string>>();
  for (const unit of units) {
    const reached = isTestPath(unit)
      ? []
      : ancestorDirectories(unit).filter((directory) =>
          directories.has(directory),
        );
    for (const directory of reached) {
      const inside = below.get(directory) ?? [];
      inside.push(unit);
      below.set(directory, inside);
    }
  }
  return below;
};

/**
 * Test code placed in a directory heats the code of that directory: its heat
 * is shared out evenly over the units below the directory, so a folder is as
 * hot as the tests that belong to it make it, whichever of its parts the tests
 * would otherwise be put with.
 */
const sharePlacedHeat = (
  heat: Map<string, number>,
  files: ReadonlyArray<TerritoryFile>,
  attachment: TestAttachment,
): void => {
  const heatOfHome = placedHeat(files, attachment);
  if (heatOfHome.size === 0) {
    return;
  }
  const below = unitsBelow(attachment.units, heatOfHome);
  for (const [directory, total] of heatOfHome) {
    const inside = below.get(directory) ?? [];
    for (const unit of inside) {
      heat.set(unit, (heat.get(unit) ?? 0) + total / inside.length);
    }
  }
};

/** The heat of every unit: its own, that of the tests paired with it, and its share of the tests placed in its directories. */
const heatByUnit = (
  files: ReadonlyArray<TerritoryFile>,
  units: ReadonlySet<string>,
  attachment: TestAttachment,
): ReadonlyMap<string, number> => {
  const heat = new Map<string, number>();
  for (const file of files) {
    const unit = unitOf(file.path, units, attachment);
    if (unit !== undefined) {
      heat.set(unit, (heat.get(unit) ?? 0) + heatOfFile(file));
    }
  }
  sharePlacedHeat(heat, files, attachment);
  return heat;
};

/**
 * The counted changes as the files that shape the tree: a test follows the
 * code it is paired with, other tests and contract files are left out; and the
 * heat those files carry.
 */
export const evidenceOf = (
  { files, changes, minChanges }: EvidenceInput,
  attachment: TestAttachment,
): Evidence => {
  const units = new Set(attachment.units);
  const touched = changes
    .map((paths) => [
      ...new Set(
        paths.flatMap((path) => unitOf(path, units, attachment) ?? []),
      ),
    ])
    .filter((touchedFiles) => touchedFiles.length > 0);
  const byFile = new Map<string, Array<number>>();
  for (const [index, touchedFiles] of touched.entries()) {
    for (const file of touchedFiles) {
      const indices = byFile.get(file) ?? [];
      indices.push(index);
      byFile.set(file, indices);
    }
  }
  const total = attachment.units.length;
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
    heat: heatByUnit(files, units, attachment),
    totalHeat: files.reduce((sum, file) => sum + heatOfFile(file), 0),
  };
};
