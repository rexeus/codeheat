/**
 * Writes the npm page's `README.md` from the repository README. npm packs only
 * files inside `apps/cli`, and it resolves relative links against the package
 * directory, so every repository-relative link becomes an absolute GitHub URL.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const blobBase = "https://github.com/rexeus/codeheat/blob/main/";

/** A markdown link target that is not absolute, an anchor, or a mail link. */
const RELATIVE_LINK = /\]\((?!https?:|#|mailto:)([^)\s]+)\)/gu;

const source = await readFile(path.join(repositoryRoot, "README.md"), "utf8");
const readme = source.replaceAll(
  RELATIVE_LINK,
  (_, target: string) => `](${new URL(target, blobBase).href})`,
);
await writeFile(path.join(packageRoot, "README.md"), readme);
console.log("Wrote README.md for the npm page.");
