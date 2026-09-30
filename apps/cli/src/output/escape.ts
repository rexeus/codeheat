// Owns the one rule for putting untrusted text (paths, patterns, git output) on a terminal.

const NEEDS_ESCAPE = /[\\\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]/gu;

/**
 * Makes `text` safe to print: backslashes double, and control characters
 * (C0, DEL, C1), line separators and bidirectional overrides become visible
 * `\uXXXX` escapes. Other Unicode is untouched.
 *
 * A path such as `a\u001b[31m.ts` would otherwise recolor the terminal or
 * start a new line. JSON output never uses this, so machines get exact values.
 */
export const escapeForTerminal = (text: string): string =>
  text.replaceAll(NEEDS_ESCAPE, (character) =>
    character === "\\"
      ? "\\\\"
      : `\\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
  );
