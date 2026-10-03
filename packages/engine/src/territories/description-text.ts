// Owns the text of a territory's description: what a manifest or a README says
// about a folder, and what its most changed files say when they say nothing.
// Every input is untrusted: manifests, READMEs, and file names are made safe
// to print, on one line, and short.
import { Option, Schema } from "effect";

import type { TerritoryFile } from "./node-measures.js";

/** A description is cut to this many characters. */
const MAX_DESCRIPTION = 160;
/** The main files named when nothing documents a folder. */
const MAIN_FILES = 3;
/** A README sentence shorter than this many words is a label, not a description. */
const MIN_WORDS = 3;
/** The lines of a README read for its first sentence. */
const README_LINES = 120;
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

const unquote = (value: string): string =>
  value.replaceAll(/\\(["\\])/gu, "$1");

const DescribedManifest = Schema.Struct({ description: Schema.String });

/** The `description` of a `package.json`; undefined when it is malformed, has none, or it is not text. */
const packageDescription = (text: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    return Option.getOrUndefined(
      Option.map(
        Schema.decodeUnknownOption(DescribedManifest)(parsed),
        ({ description }) => description,
      ),
    );
  } catch {
    return undefined;
  }
};

/** The `description = "…"` or `'…'` of a TOML manifest (`Cargo.toml`, `pyproject.toml`). */
const tomlDescription = (text: string): string | undefined => {
  const quoted = /^description\s*=\s*"((?:[^"\\]|\\.)*)"/mu.exec(text)?.[1];
  const literal = /^description\s*=\s*'([^']*)'/mu.exec(text)?.[1];
  return quoted === undefined ? literal : unquote(quoted);
};

/** The `description` a manifest declares, read from its text by its file name; undefined for a manifest kind without one or a malformed manifest. */
export const manifestDescription = (
  name: string,
  text: string,
): string | undefined => {
  if (name === "package.json") {
    return packageDescription(text);
  }
  if (name === "Cargo.toml" || name === "pyproject.toml") {
    return tomlDescription(text);
  }
  return name === "pom.xml"
    ? /<description>([^<]*)<\/description>/u.exec(text)?.[1]
    : undefined;
};

/** A paragraph that is no prose: a heading, quote, list, table, rule, link definition, or markup. */
const NOT_PROSE = /^(#|>|\||[-*+]\s|\d+[.)]\s|={3,}|-{3,}|\[[^\]]+\]:\s|<)/u;

const withoutMarkup = (text: string): string =>
  text
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replaceAll(/\[([^\]]*)\]\[[^\]]*\]/gu, "$1")
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/`|\*|__/gu, "");

const SENTENCE_END = /[.!?](?=\s+[A-Z0-9"'([]|$)/gu;
const ABBREVIATION = /(?:^|\s)(?:e\.g|i\.e|etc|vs|approx|incl)\.$/iu;

/** The text up to the first full stop, question mark, or exclamation mark that ends a sentence rather than an abbreviation; all of it when none does. */
const firstSentence = (text: string): string => {
  for (const { index } of text.matchAll(SENTENCE_END)) {
    const sentence = text.slice(0, index + 1);
    if (!ABBREVIATION.test(sentence)) {
      return sentence;
    }
  }
  return text;
};

/** The first sentence of a paragraph of README lines; undefined for markup, a heading, a label of fewer than three words, or a sentence that introduces a list or code (ends in a colon). */
const sentenceOf = (lines: ReadonlyArray<string>): string | undefined => {
  const [first, second] = lines;
  if (
    first === undefined ||
    NOT_PROSE.test(first) ||
    /^(=+|-+)$/u.test(second ?? "")
  ) {
    return undefined;
  }
  const text = withoutMarkup(lines.join(" ")).trim();
  const sentence = firstSentence(text);
  return sentence.split(/\s+/u).length < MIN_WORDS || sentence.endsWith(":")
    ? undefined
    : sentence;
};

const withoutFrontMatter = (
  lines: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  if (lines[0]?.trim() !== "---") {
    return lines;
  }
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  return end < 0 ? lines : lines.slice(end + 1);
};

/**
 * The first sentence of the first paragraph of prose in a README: headings,
 * badges, markup, code blocks, lists, and tables are passed over, links and
 * emphasis lose their markup. Undefined when the README holds no prose in its
 * first 120 lines.
 */
export const readmeSentence = (text: string): string | undefined => {
  const lines = withoutFrontMatter(text.split(/\r?\n/u)).slice(0, README_LINES);
  let paragraph: Array<string> = [];
  let fence: string | undefined;
  for (const raw of lines) {
    const line = raw.trim();
    const marker = /^(```|~~~)/u.exec(line)?.[1];
    if (fence !== undefined) {
      fence = marker === fence ? undefined : fence;
      continue;
    }
    fence = marker;
    if (line === "" || marker !== undefined) {
      const found = sentenceOf(paragraph);
      if (found !== undefined) {
        return found;
      }
      paragraph = [];
    } else {
      paragraph.push(line);
    }
  }
  return sentenceOf(paragraph);
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
