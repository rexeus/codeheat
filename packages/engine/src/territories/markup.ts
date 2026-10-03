// Owns stripping Markdown and HTML markup from README text in linear time.
// A regular expression with a lazy or negated class that runs to a closing
// character is quadratic on text made of openers that never close, so the
// closers are found by a search that remembers its last answer: asked for
// positions that only grow, all its answers together cost one pass.

/**
 * A search for the first `needle` at or after a position. The positions asked
 * must not decrease; the work over all asks is then one scan of the text.
 */
const finderOf = (text: string, needle: string): ((from: number) => number) => {
  let found = -2;
  return (from) => {
    if (found === -1 || found >= from) {
      return found;
    }
    found = text.indexOf(needle, from);
    return found;
  };
};

/** What a bracketed part continues with: a parenthesized target, or a reference. */
type Closers = {
  readonly close: (from: number) => number;
  readonly paren: (from: number) => number;
  readonly reference: (from: number) => number;
};

const closersOf = (text: string): Closers => ({
  close: finderOf(text, "]"),
  paren: finderOf(text, ")"),
  reference: finderOf(text, "]"),
});

/** Where the `[…]` that opens at `open` ends including its `(…)` or `[…]` target, and where its own text ends; undefined when it is no link. */
const bracketed = (
  text: string,
  open: number,
  { close, paren, reference }: Closers,
): { readonly end: number; readonly textEnd: number } | undefined => {
  const textEnd = close(open + 1);
  const next = textEnd < 0 ? "" : text.charAt(textEnd + 1);
  if (next !== "(" && next !== "[") {
    return undefined;
  }
  const targetEnd = next === "(" ? paren(textEnd + 2) : reference(textEnd + 2);
  return targetEnd < 0 ? undefined : { end: targetEnd + 1, textEnd };
};

/**
 * `text` with every `opener…` construct that `bracketed` finds replaced by
 * what `keep` makes of it; an opener that starts none stays as it is.
 */
const replaceConstructs = (
  text: string,
  opener: string,
  skip: number,
  keep: (inner: string) => string,
): string => {
  const closers = closersOf(text);
  const parts: Array<string> = [];
  let copied = 0;
  for (
    let start = text.indexOf(opener);
    start >= 0;
    start = text.indexOf(opener, start + skip)
  ) {
    const construct = bracketed(text, start + skip - 1, closers);
    if (construct !== undefined) {
      parts.push(
        text.slice(copied, start),
        keep(text.slice(start + skip, construct.textEnd)),
      );
      copied = construct.end;
      start = construct.end - skip;
    }
  }
  parts.push(text.slice(copied));
  return parts.join("");
};

/** `text` without images, `![alt](url)` and `![alt][reference]`. */
export const withoutImages = (text: string): string =>
  replaceConstructs(text, "![", 2, () => "");

/** `text` with each link, `[text](url)` and `[text][reference]`, reduced to its text, or to nothing. */
export const withoutLinks = (text: string, keepText: boolean): string =>
  replaceConstructs(text, "[", 1, (inner) => (keepText ? inner : ""));

/** `text` without HTML tags and comments, anything from `<` to the next `>`. */
export const withoutHtml = (text: string): string => {
  const close = finderOf(text, ">");
  const parts: Array<string> = [];
  let copied = 0;
  for (
    let start = text.indexOf("<");
    start >= 0;
    start = text.indexOf("<", copied)
  ) {
    const end = close(start + 1);
    if (end < 0) {
      break;
    }
    parts.push(text.slice(copied, start));
    copied = end + 1;
  }
  parts.push(text.slice(copied));
  return parts.join("");
};
