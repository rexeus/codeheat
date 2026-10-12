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

/** What `--no-default-excludes` would keep: all the files left out, or only the defaults' share when `--exclude` took part too. */
const keepHint = (used: ReadonlyArray<Exclude>): string => {
  const defaults = used.filter(({ source }) => source === "default");
  if (defaults.length === 0) {
    return "";
  }
  if (defaults.length === used.length) {
    return " --no-default-excludes keeps them.";
  }
  const files = defaults.reduce((sum, exclude) => sum + exclude.files, 0);
  return ` --no-default-excludes keeps the ${count(files)} the defaults left out.`;
};

/**
 * One line on the files the exclude patterns left out (see
 * `Analysis.excludes`), with how many patterns of each source took part and
 * the one that took the most; when a default pattern took part, the flag that
 * keeps what the defaults left out. Nothing when no pattern left a file out.
 */
export const excludedLines = ({
  excludes,
}: Pick<Analysis, "excludes">): ReadonlyArray<string> => {
  const used = excludes.filter(({ files }) => files > 0);
  if (used.length === 0) {
    return [];
  }
  const files = used.reduce((sum, exclude) => sum + exclude.files, 0);
  return [
    `Left out: ${count(files)} ${files === 1 ? "file" : "files"} by ${byPatterns(used)} (${mostOf(used)}).${keepHint(used)}`,
  ];
};
