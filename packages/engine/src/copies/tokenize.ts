// Owns reading source text as the words it is made of, for similarity: no
// language grammar, only the shape of identifiers, keywords, and literals.

/** Stands for any string literal, whatever it says. */
const STRING = '"';
/** Stands for any number, whatever its value. */
const NUMBER = "0";

const SLASH = 47;
const STAR = 42;
const HASH = 35;
const BANG = 33;
const LESS_THAN = 60;
const BACKSLASH = 92;
const DOUBLE_QUOTE = 34;
const APOSTROPHE = 39;
const BACKTICK = 96;

/** The character code at `index`; -1 past the end, which no check below accepts. */
const codeAt = (text: string, index: number): number =>
  text.codePointAt(index) ?? -1;

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

const isWordCharacter = (code: number): boolean =>
  isDigit(code) ||
  (code >= 65 && code <= 90) ||
  (code >= 97 && code <= 122) ||
  code === 95 ||
  code === 36 ||
  code > 127;

const isBlank = (code: number): boolean =>
  code === 32 || code === 9 || code === 13 || code === 10;

const isQuote = (code: number): boolean =>
  code === DOUBLE_QUOTE || code === APOSTROPHE || code === BACKTICK;

/** Index of the line break that ends the line holding `from`, or the end of the text. */
const endOfLine = (text: string, from: number): number => {
  const end = text.indexOf("\n", from);
  return end === -1 ? text.length : end;
};

/** Index after the closing `marker` at or after `from`, or the end of the text. */
const endOfBlock = (text: string, from: number, marker: string): number => {
  const end = text.indexOf(marker, from);
  return end === -1 ? text.length : end + marker.length;
};

/**
 * Index after the string literal that opens at `start`. A quote or double
 * quote ends within its line (a lone apostrophe, as in a Rust lifetime, must
 * not swallow the file); a backtick runs to the next one.
 */
const endOfString = (text: string, start: number): number => {
  const quote = codeAt(text, start);
  const limit = quote === BACKTICK ? text.length : endOfLine(text, start);
  let index = start + 1;
  while (index < limit) {
    const code = codeAt(text, index);
    if (code === quote) {
      return index + 1;
    }
    index += code === BACKSLASH ? 2 : 1;
  }
  return limit;
};

/** Index after the run of word characters that starts at `start`. */
const endOfWord = (text: string, start: number): number => {
  let index = start;
  while (isWordCharacter(codeAt(text, index))) {
    index += 1;
  }
  return index;
};

/** A `#` that opens a comment: at the start of a line, followed by a blank, `!`, `#`, or the end of the line. */
const isHashComment = (
  text: string,
  index: number,
  atLineStart: boolean,
): boolean => {
  const next = codeAt(text, index + 1);
  return (
    atLineStart &&
    (next === -1 || isBlank(next) || next === BANG || next === HASH)
  );
};

/** `/`, `<`, and `#` can open a comment; no other character does. */
const isCommentStart = (code: number): boolean =>
  code === SLASH || code === LESS_THAN || code === HASH;

/** The index after the comment that starts at `index`, or `index` itself when none does. */
const skipComment = (
  text: string,
  index: number,
  atLineStart: boolean,
): number => {
  const code = codeAt(text, index);
  if (code === SLASH) {
    const next = codeAt(text, index + 1);
    if (next === SLASH) {
      return endOfLine(text, index);
    }
    return next === STAR ? endOfBlock(text, index + 2, "*/") : index;
  }
  if (code === LESS_THAN) {
    return text.startsWith("<!--", index)
      ? endOfBlock(text, index + 4, "-->")
      : index;
  }
  return isHashComment(text, index, atLineStart)
    ? endOfLine(text, index)
    : index;
};

/** The word, string, or number that starts at `index` and the index after it; undefined for anything else. */
const wordAt = (
  text: string,
  index: number,
): { readonly token: string; readonly end: number } | undefined => {
  const code = codeAt(text, index);
  if (isQuote(code)) {
    return { token: STRING, end: endOfString(text, index) };
  }
  if (!isWordCharacter(code)) {
    return undefined;
  }
  const end = endOfWord(text, index);
  return { token: isDigit(code) ? NUMBER : text.slice(index, end), end };
};

/**
 * Reads `text` as a list of words: identifiers and keywords as they are, every
 * string literal as one `"` and every number as one `0`. Whitespace,
 * punctuation, and comments (`//`, `/* *\/`, `<!-- -->`, and `#` at the start of
 * a line) contribute nothing, so formatting and prose cannot make two files
 * differ. A quote inside a regular expression or a `//` inside one, or a `#`
 * comment after code, is read as these language-agnostic rules say, not as the
 * language would.
 */
export const tokenize = (text: string): ReadonlyArray<string> => {
  const tokens: Array<string> = [];
  let atLineStart = true;
  let index = 0;
  while (index < text.length) {
    const code = codeAt(text, index);
    const afterComment = isCommentStart(code)
      ? skipComment(text, index, atLineStart)
      : index;
    const word = afterComment === index ? wordAt(text, index) : undefined;
    if (word !== undefined) {
      tokens.push(word.token);
      index = word.end;
      atLineStart = false;
    } else if (afterComment === index) {
      atLineStart = code === 10 || (atLineStart && isBlank(code));
      index += 1;
    } else {
      index = afterComment;
    }
  }
  return tokens;
};
