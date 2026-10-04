// Owns how a finding that is about files names them in one short phrase, so
// that a line which only says "Hub in database" can say which file is the hub.
import type { EntryKind } from "./evidence.js";

/** How many files a phrase names before it counts the rest. */
const NAMED_FILES = 2;

/** The last `parts` segments of `path`. */
const tail = (path: string, parts: number): string =>
  path.split("/").slice(-parts).join("/");

/** The file names of `paths`, each with as many of its folders as it takes to tell equal names apart. */
const labelsOf = (paths: readonly string[]): string[] => {
  const deepest = Math.max(1, ...paths.map((path) => path.split("/").length));
  for (let parts = 1; parts < deepest; parts += 1) {
    const labels = paths.map((path) => tail(path, parts));
    if (new Set(labels).size === labels.length) {
      return labels;
    }
  }
  return paths.map((path) => tail(path, deepest));
};

const copiesOf = (files: readonly string[]): string => {
  const named = labelsOf(files.slice(0, NAMED_FILES)).join(", ");
  const rest = files.length - NAMED_FILES;
  return rest > 0 ? `${named} +${rest} more` : named;
};

const none = (): string => "";

const SUBJECTS: Record<EntryKind, (files: readonly string[]) => string> = {
  boundary: none,
  hotspot: none,
  clique: none,
  hub: (files) => labelsOf(files.slice(0, 1)).join(""),
  coupling: (files) => labelsOf(files.slice(0, NAMED_FILES)).join(" ↔ "),
  copies: copiesOf,
};

/**
 * The files a finding of `kind` is about, in a phrase: the hub, the two files
 * of a hidden coupling, the first of a family of copies and how many more
 * there are. Empty for a kind about territories, and when no file is named.
 */
export const subjectOf = (kind: EntryKind, files: readonly string[]): string =>
  SUBJECTS[kind](files);
