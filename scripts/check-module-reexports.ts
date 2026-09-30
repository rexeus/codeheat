/**
 * Keeps public APIs narrow by reserving barrel-style export lists for package
 * entry points (`<apps|packages>/<name>/src/index.ts`). Modules inside a
 * package import directly from the module that owns a symbol.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SOURCE_ROOTS = ["apps", "packages"];
const TYPESCRIPT_SOURCE = /\.[cm]?tsx?$/u;
const PACKAGE_ENTRY_POINT =
  /^(?:apps|packages)\/[^/]+\/src\/index\.[cm]?tsx?$/u;
const BARREL_EXPORT = /^\s*export\s+(?:type\s+)?(?:\*|\{)/u;

const sourceFilesIn = (directory: string): Array<string> =>
  readdirSync(directory, { withFileTypes: true })
    .toSorted((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return sourceFilesIn(entryPath);
      }
      return TYPESCRIPT_SOURCE.test(entry.name) ? [entryPath] : [];
    });

const reexportsIn = (file: string): Array<string> => {
  if (PACKAGE_ENTRY_POINT.test(file.split(path.sep).join("/"))) {
    return [];
  }
  return readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line, index) =>
      BARREL_EXPORT.test(line) ? [`${file}:${index + 1}`] : [],
    );
};

const sourceFiles = SOURCE_ROOTS.filter((root) => existsSync(root)).flatMap(
  (root) => sourceFilesIn(root),
);
const violations = sourceFiles.flatMap((file) => reexportsIn(file));

if (violations.length > 0) {
  console.error(
    "Barrel-style export lists are allowed only in package entry points (src/index.ts):\n" +
      violations.map((violation) => `- ${violation}`).join("\n"),
  );
  process.exitCode = 1;
}
