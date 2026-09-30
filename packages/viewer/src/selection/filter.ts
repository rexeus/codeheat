import picomatch from "picomatch/posix";

export type PathMatcher = (path: string) => boolean;

const GLOB_METACHARACTERS = /[*?[\]{}()!]/u;

const substringMatcher = (input: string): PathMatcher => {
  const needle = input.toLowerCase();
  return (path) => path.toLowerCase().includes(needle);
};

/**
 * Turns the filter box text into a matcher, or `null` when nothing is typed.
 *
 * Text with glob metacharacters is a picomatch glob (a pattern without a slash
 * matches the file name at any depth). Any other text is a case-insensitive
 * substring.
 */
export const createPathMatcher = (input: string): PathMatcher | null => {
  const text = input.trim();
  if (text === "") {
    return null;
  }
  if (!GLOB_METACHARACTERS.test(text)) {
    return substringMatcher(text);
  }
  return picomatch(text, { dot: true, matchBase: !text.includes("/") });
};
