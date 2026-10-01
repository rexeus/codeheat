// Owns grouping files by directory when no manifest says what a module is.

const directoriesOf = (file: string): ReadonlyArray<string> =>
  file.split("/").slice(0, -1);

const depthOf = (file: string): number => directoriesOf(file).length;

/** The first `depth` directories of the file as one path; "." for a file at the root. */
const directoryAtDepth = (file: string, depth: number): string =>
  directoriesOf(file).slice(0, depth).join("/") || ".";

/**
 * Maps each file to a directory module: its directory cut at the first depth
 * where the files split into at least two directories, so a lone `src/`
 * descends to `src/billing` and `src/auth`. A file with fewer directories than
 * the depth being tried does not take part in that step and, at the end,
 * stays in its own directory; files at the root form module ".".
 */
export const splitByDirectory = (
  files: ReadonlyArray<string>,
): ReadonlyMap<string, string> => {
  const deepest = Math.max(0, ...files.map((file) => depthOf(file)));
  const splitsAt = (depth: number): boolean =>
    new Set(
      files
        .filter((file) => depthOf(file) >= depth)
        .map((file) => directoryAtDepth(file, depth)),
    ).size >= 2;
  let depth = 1;
  while (depth < deepest && !splitsAt(depth)) {
    depth += 1;
  }
  return new Map(files.map((file) => [file, directoryAtDepth(file, depth)]));
};
