// Owns reading the `description` a package manifest declares. A manifest is
// untrusted input: a malformed one declares nothing, and nothing is evaluated.
import { Option, Schema } from "effect";

import { pomDescription } from "./pom-description.js";

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

/** The tables of a TOML manifest that describe the package itself. */
const DESCRIBING_TABLES = new Set(["package", "project", "tool.poetry"]);

/** TOML basic strings: an escaped quote or backslash is the character, a backslash at the end of a line joins it to the next. */
const unescapeBasic = (value: string): string =>
  value.replaceAll(/\\\r?\n\s*/gu, "").replaceAll(/\\(["\\])/gu, "$1");

/** The first `description` of a TOML table's body in any of the four string forms; a multi-line string drops its first line break. */
const stringIn = (body: string): string | undefined => {
  const multiline = /^description\s*=\s*"""\r?\n?([\s\S]*?)"""/mu.exec(
    body,
  )?.[1];
  const literalMultiline = /^description\s*=\s*'''\r?\n?([\s\S]*?)'''/mu.exec(
    body,
  )?.[1];
  const basic = /^description\s*=\s*"((?:[^"\\]|\\.)*)"/mu.exec(body)?.[1];
  const literal = /^description\s*=\s*'([^']*)'/mu.exec(body)?.[1];
  if (multiline !== undefined) {
    return unescapeBasic(multiline);
  }
  if (literalMultiline !== undefined) {
    return literalMultiline;
  }
  return basic === undefined ? literal : unescapeBasic(basic);
};

/**
 * The `description` of a TOML manifest (`Cargo.toml`, `pyproject.toml`) in
 * its `[package]`, `[project]`, or `[tool.poetry]` table, as a basic or literal
 * string, on one line or several.
 */
const tomlDescription = (text: string): string | undefined => {
  for (const section of text.split(/^(?=\s*\[)/mu)) {
    const table = /^\s*\[([^[\]]+)\]/u.exec(section)?.[1]?.trim() ?? "";
    const found = DESCRIBING_TABLES.has(table) ? stringIn(section) : undefined;
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
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
  return name === "pom.xml" ? pomDescription(text) : undefined;
};
