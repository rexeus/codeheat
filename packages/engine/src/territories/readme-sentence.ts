// Owns reading the first sentence of prose out of a README. A README is
// untrusted input of any size and shape, so every step works on a bounded
// piece of text: at most `README_LINES` lines, and of the paragraph that
// holds the sentence at most `MAX_PARAGRAPH` characters.

import { withoutHtml, withoutImages, withoutLinks } from "./markup.js";

/** The lines of a README read for its first sentence. */
const README_LINES = 120;
/** The characters of a paragraph read; the regular expressions below see no more. */
const MAX_PARAGRAPH = 2048;
/** A README sentence shorter than this many words is a label, not a description. */
const MIN_WORDS = 3;

/**
 * A paragraph that is no prose: a heading, quote, list, table, rule, link
 * definition, markup, or a reStructuredText directive, comment, or field
 * (`.. image::`, `:alt:`); indented code is tested apart.
 */
const NOT_PROSE =
  /^(?:#|>|\||\+-|[-*+]\s|\d+[.)]\s|={3,}|-{3,}|\[[^\]]+\]:\s|<|\.\.(?:\s|$)|:[\w-]+:)/u;

/** The text of a paragraph without images, links (their text stays), markup, and emphasis. */
const withoutMarkup = (text: string): string =>
  withoutHtml(withoutLinks(withoutImages(text), true)).replaceAll(
    /`|\*|__/gu,
    "",
  );

/** The paragraph is nothing but images and links (a row of badges, a list of references). */
const onlyLinks = (text: string): boolean =>
  withoutHtml(withoutLinks(withoutImages(text), false)).replaceAll(
    /[\s|·•,.\-–—:/]+/gu,
    "",
  ) === "";

/**
 * A sentence that tells the reader what to do, not what the code is: it opens
 * with an instruction ("See", "After", "Run", "To", "Before", "Note:", "Make
 * sure", "Please", "Refer to"). Such a README line is not a description.
 */
const INSTRUCTION =
  /^(?:see|after|run(?!\s+time\b)|to|before|please|refer to|make sure|note(?::|\s+that\b))(?=[\s:,]|$)/iu;

/** A word with a slash and an extension, such as `src/tools/helper.ts`. */
const FILE_PATH = /[\w.@~-]+\/[\w./@~-]*\.[A-Za-z][A-Za-z0-9]{0,7}\b/gu;

/** A segment that starts with a capital letter, as in `React/Next.js`. */
const CAPITALIZED = /^\p{Lu}/u;

/**
 * Whether the sentence names a file path. A word whose every segment starts
 * with a capital letter (`React/Next.js`, `TypeScript/Node.js`) is a pair of
 * product names, not a path.
 */
const namesPath = (sentence: string): boolean =>
  [...sentence.matchAll(FILE_PATH)].some(([word]) =>
    word.split("/").some((segment) => !CAPITALIZED.test(segment)),
  );

const isInstruction = (sentence: string): boolean =>
  INSTRUCTION.test(sentence) || namesPath(sentence);

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

/**
 * The first sentence of a paragraph of README lines; undefined for markup, a
 * heading, a row of images or links, a label of fewer than three words, text
 * with no alphabetic word, a sentence that introduces a list or code (ends in
 * a colon), or one that instructs or points at a file (see `isInstruction`).
 */
const sentenceOf = (lines: ReadonlyArray<string>): string | undefined => {
  const [first, second] = lines;
  if (
    first === undefined ||
    NOT_PROSE.test(first.trimStart()) ||
    /^(?: {4}|\t)/u.test(first) ||
    /^(?:=+|-+)$/u.test(second?.trim() ?? "")
  ) {
    return undefined;
  }
  const raw = lines
    .map((line) => line.trim())
    .join(" ")
    .slice(0, MAX_PARAGRAPH);
  const sentence = onlyLinks(raw)
    ? ""
    : firstSentence(withoutMarkup(raw).trim());
  return sentence.split(/\s+/u).length < MIN_WORDS ||
    sentence.endsWith(":") ||
    !/\p{L}{2,}/u.test(sentence) ||
    isInstruction(sentence)
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
 * badges, markup, code blocks, lists, tables, and reStructuredText directives
 * are passed over, links and emphasis lose their markup, and so are
 * instructions and sentences that name a file path ("See src/x.ts for an
 * example."), the next paragraph taking their place. Undefined when the
 * README holds no prose in its first 120 lines. The work is bounded by the
 * lines and the paragraph length read, whatever the README looks like.
 */
export const readmeSentence = (text: string): string | undefined => {
  const lines = withoutFrontMatter(
    text.slice(0, README_LINES * MAX_PARAGRAPH).split(/\r?\n/u),
  ).slice(0, README_LINES);
  let paragraph: Array<string> = [];
  let length = 0;
  let fence: string | undefined;
  for (const raw of lines) {
    const line = raw.slice(0, MAX_PARAGRAPH);
    const marker = /^\s*(```|~~~)/u.exec(line)?.[1];
    if (fence !== undefined) {
      fence = marker === fence ? undefined : fence;
      continue;
    }
    fence = marker;
    if (line.trim() === "" || marker !== undefined) {
      const found = sentenceOf(paragraph);
      if (found !== undefined) {
        return found;
      }
      paragraph = [];
      length = 0;
    } else if (length < MAX_PARAGRAPH) {
      paragraph.push(line);
      length += line.length;
    }
  }
  return sentenceOf(paragraph);
};
