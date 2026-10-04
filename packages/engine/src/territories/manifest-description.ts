// Owns reading the `description` a package manifest declares. A manifest is
// untrusted input: a malformed one declares nothing, and nothing is evaluated.
import { Option, Schema } from "effect";

import { pomDescription } from "./pom-description.js";
import { tomlDescription } from "./toml-description.js";

/** How much of a TOML or XML manifest is read; its description comes first. */
const MAX_MANIFEST_TEXT = 65_536;

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

/** The `description` a manifest declares, read from its text by its file name; undefined for a manifest kind without one or a malformed manifest. */
export const manifestDescription = (
  name: string,
  text: string,
): string | undefined => {
  if (name === "package.json") {
    return packageDescription(text);
  }
  if (name === "Cargo.toml" || name === "pyproject.toml") {
    return tomlDescription(text.slice(0, MAX_MANIFEST_TEXT));
  }
  return name === "pom.xml"
    ? pomDescription(text.slice(0, MAX_MANIFEST_TEXT))
    : undefined;
};
