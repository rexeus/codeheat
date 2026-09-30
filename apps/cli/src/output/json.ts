// Owns the machine-readable form: exactly one JSON document.

const RAW_SEPARATORS = /[\u007F-\u009F\u2028\u2029]/gu;

/**
 * Serializes `value` as one line of JSON.
 *
 * `JSON.stringify` escapes quotes, backslashes and C0 controls but leaves DEL,
 * C1 controls and the Unicode line separators raw. Those become `\uXXXX`, so
 * the document still decodes to the exact values yet cannot drive a terminal.
 */
export const renderJson = (value: unknown): string =>
  JSON.stringify(value).replaceAll(
    RAW_SEPARATORS,
    (character) =>
      `\\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
  );
