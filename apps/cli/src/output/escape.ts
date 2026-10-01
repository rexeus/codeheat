// Owns the one rule for putting untrusted text (paths, patterns, git output) on a terminal.

const UNSAFE = String.raw`\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069`;

// A run of backslashes is ambiguous only before one of our own escapes: a `uXXXX`
// shape or a character that is about to become one.
const NEEDS_ESCAPE = new RegExp(
  String.raw`\\+(?=u[0-9a-f]{4}|[${UNSAFE}])|[${UNSAFE}]`,
  "gu",
);

/**
 * Makes `text` safe to print: control characters (C0, DEL, C1), line
 * separators and bidirectional overrides become visible `\uXXXX` escapes
 * (lowercase hex). Other Unicode is untouched.
 *
 * Every backslash run that directly precedes such an escape, or a literal
 * `uXXXX` (four lowercase hex digits) that looks like one, is doubled. In the
 * output, a run of backslashes before `uXXXX` is therefore even for literal
 * backslashes and odd for an escape, so distinct paths never print alike.
 * All other backslashes stay, so `C:\Users\me` prints unchanged.
 *
 * A path such as `a\u001b[31m.ts` would otherwise recolor the terminal or
 * start a new line. JSON output never uses this, so machines get exact values.
 */
export const escapeForTerminal = (text: string): string =>
  text.replaceAll(NEEDS_ESCAPE, (match) =>
    match.startsWith("\\")
      ? match + match
      : `\\u${(match.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
  );
