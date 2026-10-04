// Owns reading the `description` of a TOML manifest (`Cargo.toml`,
// `pyproject.toml`). The manifest is untrusted input: it is read line by line,
// each line only as far as it can matter, so no shape of file takes more than
// linear time.

/** The tables of a TOML manifest that describe the package itself. */
const DESCRIBING_TABLES = new Set(["package", "project", "tool.poetry"]);
/** How much of a line is read to tell a table header or a key. */
const MAX_KEY_LINE = 256;
/** How much text after a `description` key is read for its value, a multi-line string included. */
const MAX_VALUE = 16_384;

/** TOML basic strings: an escaped quote or backslash is the character, a backslash at the end of a line joins it to the next. */
const unescapeBasic = (value: string): string =>
  value.replaceAll(/\\\r?\n\s*/gu, "").replaceAll(/\\(["\\])/gu, "$1");

/** The string a `description = …` entry that starts `entry` holds, in any of the four forms; a multi-line string drops its first line break. */
const stringOf = (entry: string): string | undefined => {
  const multiline = /^\s*description\s*=\s*"""\r?\n?([\s\S]*?)"""/u.exec(
    entry,
  )?.[1];
  const literalMultiline = /^\s*description\s*=\s*'''\r?\n?([\s\S]*?)'''/u.exec(
    entry,
  )?.[1];
  const basic = /^\s*description\s*=\s*"((?:[^"\\]|\\.)*)"/u.exec(entry)?.[1];
  const literal = /^\s*description\s*=\s*'([^']*)'/u.exec(entry)?.[1];
  if (multiline !== undefined) {
    return unescapeBasic(multiline);
  }
  if (literalMultiline !== undefined) {
    return literalMultiline;
  }
  return basic === undefined ? literal : unescapeBasic(basic);
};

/** The table a header line opens (an array of tables is "" and describes nothing); undefined for a line that is no header. */
const tableOf = (line: string): string | undefined => {
  const header = line.trimStart();
  return header.startsWith("[")
    ? (/^\[([^[\]]+)\]/u.exec(header.slice(0, MAX_KEY_LINE))?.[1]?.trim() ?? "")
    : undefined;
};

/**
 * The `description` of a TOML manifest in its `[package]`, `[project]`, or
 * `[tool.poetry]` table, as a basic or literal string, on one line or several.
 */
export const tomlDescription = (text: string): string | undefined => {
  let table = "";
  let offset = 0;
  for (const line of text.split("\n")) {
    const opened = tableOf(line);
    table = opened ?? table;
    if (
      opened === undefined &&
      DESCRIBING_TABLES.has(table) &&
      /^\s*description\s*=/u.test(line.slice(0, MAX_KEY_LINE))
    ) {
      const found = stringOf(text.slice(offset, offset + MAX_VALUE));
      if (found !== undefined) {
        return found;
      }
    }
    offset += line.length + 1;
  }
  return undefined;
};
