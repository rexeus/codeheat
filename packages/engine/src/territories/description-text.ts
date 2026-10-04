// Owns the text of a territory's description: making any text safe to print,
// and naming a folder's most changed files when nothing documents it.
// Every input is untrusted: file names are made safe to print, on one line,
// and short.
import type { TerritoryFile } from "./node-measures.js";

/** A description is cut to this many characters. */
const MAX_DESCRIPTION = 160;
/** The main files named when nothing documents a folder. */
const MAIN_FILES = 3;
/** File names that tell nothing without their folder. */
const GENERIC_STEMS = new Set(["index", "main", "mod", "lib", "__init__"]);

const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;
const FORMAT = /\p{Cf}+/gu;

/**
 * Makes `text` one safe line of at most 160 characters: control characters,
 * line breaks, and runs of white space become one space, invisible format
 * characters (bidirectional overrides, zero-width marks) are dropped, and a
 * longer text is cut at a word with an ellipsis. Empty when nothing is left.
 */
export const tidy = (text: string): string => {
  const line = text
    .replaceAll(FORMAT, "")
    .replaceAll(CONTROL, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
  const characters = Array.from(line);
  if (characters.length <= MAX_DESCRIPTION) {
    return line;
  }
  const cut = characters.slice(0, MAX_DESCRIPTION - 1).join("");
  const word = cut.lastIndexOf(" ");
  return `${(word > MAX_DESCRIPTION / 2 ? cut.slice(0, word) : cut).trimEnd()}…`;
};

const stemOf = (path: string): string => {
  const parts = path.split("/");
  const name = parts.at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return GENERIC_STEMS.has(stem) && parts.length > 1
    ? `${parts.at(-2)}/${stem}`
    : stem;
};

/**
 * `main files: a, b, c`: the stems of the three most changed files among
 * `members` (test code only when there is nothing else), most changes first,
 * then the larger file, then path. Empty without files.
 */
export const mainFiles = (
  members: ReadonlyArray<string>,
  files: ReadonlyMap<string, TerritoryFile>,
): string => {
  const known = members.flatMap((path) => files.get(path) ?? []);
  const code = known.filter((file) => !file.test);
  const stems = [
    ...new Set(
      (code.length > 0 ? code : known)
        .toSorted(
          (a, b) =>
            b.changes - a.changes ||
            b.loc - a.loc ||
            a.path.localeCompare(b.path),
        )
        .map(({ path }) => stemOf(path)),
    ),
  ].slice(0, MAIN_FILES);
  return stems.length === 0 ? "" : `main files: ${stems.join(", ")}`;
};
