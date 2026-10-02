// Owns the default answer to "is this a contract file?": interface definition
// and schema files whose changes drive changes in code. They take part in
// coupling, but never get a hotspot score; indentation says nothing about them.

/** Languages whose only purpose is to define an interface or a schema. */
const CONTRACT_EXTENSIONS: ReadonlySet<string> = new Set([
  "tsp",
  "proto",
  "graphql",
  "gql",
  "avsc",
  "thrift",
  "smithy",
]);

/** A JSON Schema file by convention: `user.schema.json`. */
const JSON_SCHEMA_NAME = /\.schema\.json$/iu;

/** An API description by name: `openapi.yaml`, `asyncapi.v2.json`, `swagger.yml`. */
const API_DESCRIPTION_NAME =
  /^(?:openapi|asyncapi|swagger)\.(?:.+\.)?(?:ya?ml|json)$/iu;

const extensionOf = (name: string): string => {
  const extensionStart = name.lastIndexOf(".");
  return extensionStart > 0 ? name.slice(extensionStart + 1).toLowerCase() : "";
};

/**
 * Whether the path names a contract file: an IDL or schema language
 * (`.tsp`, `.proto`, `.graphql`, `.gql`, `.avsc`, `.thrift`, `.smithy`), a JSON
 * Schema (`*.schema.json`), or an OpenAPI, AsyncAPI, or Swagger description
 * (`openapi.*`, `asyncapi.*`, `swagger.*` in YAML or JSON). It looks at the
 * file name only; the universe's directory exclusions still apply.
 */
export const isContractFile = (path: string): boolean => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return (
    CONTRACT_EXTENSIONS.has(extensionOf(name)) ||
    JSON_SCHEMA_NAME.test(name) ||
    API_DESCRIPTION_NAME.test(name)
  );
};
