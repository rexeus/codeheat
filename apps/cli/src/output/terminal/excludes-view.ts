// Owns how the terminal says what the analysis left out by name: the files the
// exclude patterns matched, the pattern that took the most, and how to keep them.
import type { Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { count } from "./format.js";

type Exclude = Analysis["excludes"][number];

const patterns = (number: number, kind: string): string =>
  `${number} ${kind} ${number === 1 ? "pattern" : "patterns"}`;

/** Which patterns left files out: how many of the defaults and of `--exclude`. */
const byPatterns = (used: ReadonlyArray<Exclude>): string => {
  const defaults = used.filter(({ source }) => source === "default").length;
  const users = used.length - defaults;
  return [
    ...(defaults === 0 ? [] : [patterns(defaults, "default")]),
    ...(users === 0 ? [] : [patterns(users, "--exclude")]),
  ].join(" and ");
};

/** The pattern that left the most files out, the first of a tie; with several, its count too. */
const mostOf = (used: ReadonlyArray<Exclude>): string => {
  const most = used.reduce((best, exclude) =>
    exclude.files > best.files ? exclude : best,
  );
  const pattern = escapeForTerminal(most.pattern);
  return used.length === 1 ? pattern : `most: ${pattern} ${count(most.files)}`;
};

/**
 * One line on the files the exclude patterns left out (see
 * `Analysis.excludes`), with how many patterns of each source took part and
 * the one that took the most; when a default pattern took part, the flag that
 * keeps them. Nothing when no pattern left a file out.
 */
export const excludedLines = ({
  excludes,
}: Pick<Analysis, "excludes">): ReadonlyArray<string> => {
  const used = excludes.filter(({ files }) => files > 0);
  if (used.length === 0) {
    return [];
  }
  const files = used.reduce((sum, exclude) => sum + exclude.files, 0);
  const keep = used.some(({ source }) => source === "default")
    ? " --no-default-excludes keeps them."
    : "";
  return [
    `Left out: ${count(files)} ${files === 1 ? "file" : "files"} by ${byPatterns(used)} (${mostOf(used)}).${keep}`,
  ];
};
