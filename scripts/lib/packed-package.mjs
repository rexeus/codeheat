// Reads a packed `codeheat` tarball without trusting it: what it contains and
// what its manifest declares.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads one field of a JSON object without trusting its shape.
 * @param {string} json
 * @param {string} field
 * @returns {unknown}
 */
export const fieldOf = (json, field) => {
  /** @type {unknown} */
  const value = JSON.parse(json);
  return typeof value === "object" && value !== null && field in value
    ? Object.getOwnPropertyDescriptor(value, field)?.value
    : undefined;
};

/**
 * @param {string} tarball
 * @param {string} file
 */
const readPacked = (tarball, file) =>
  execFileSync("tar", ["-xOzf", tarball, file], { encoding: "utf8" });

/**
 * The packed manifest declares oxc-parser, pinned to an exact version, as its
 * only runtime dependency.
 * @param {string} packedManifest
 */
const expectPinnedParserOnly = (packedManifest) => {
  const dependencies = fieldOf(packedManifest, "dependencies");
  const found =
    typeof dependencies === "object" && dependencies !== null
      ? JSON.stringify(dependencies)
      : "none";
  if (!/^\{"oxc-parser":"\d+\.\d+\.\d+"\}$/u.test(found)) {
    throw new Error(
      `The packed manifest must declare exactly one runtime dependency, oxc-parser, pinned to an exact version; found: ${found}.`,
    );
  }
};

/**
 * The tarball holds the bundle, the license, the readme and the manifest, and
 * nothing else; the readme links absolutely, the license matches the
 * repository's, and the manifest has the one pinned dependency.
 * @param {string} tarball
 * @param {string} repository
 */
export const expectBundledArtifact = (tarball, repository) => {
  const listing = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  const files = listing.trim().split("\n").toSorted();
  const expected = new Set([
    "package/dist/codeheat.js",
    "package/package.json",
  ]);
  const unexpected = files.filter(
    (file) =>
      !expected.has(file) &&
      !/^package\/(README|LICENSE|CHANGELOG)/u.test(file),
  );
  const required = [
    "package/dist/codeheat.js",
    "package/LICENSE",
    "package/README.md",
  ];
  if (required.some((file) => !files.includes(file)) || unexpected.length > 0) {
    throw new Error(`Unexpected package contents:\n${files.join("\n")}`);
  }
  // npm resolves relative links against the package directory, where the
  // repository's docs do not exist; the packed README must link absolutely.
  const relativeLinks = readPacked(tarball, "package/README.md").match(
    /\]\((?!https?:|#|mailto:)[^)\s]+\)/gu,
  );
  if (relativeLinks !== null) {
    throw new Error(
      `The packed README has relative links: ${relativeLinks.join(", ")}`,
    );
  }
  // The build copies the repository LICENSE into apps/cli; the packed copy must match it.
  const license = readFileSync(join(repository, "LICENSE"), "utf8");
  if (readPacked(tarball, "package/LICENSE") !== license) {
    throw new Error("The packed LICENSE differs from the repository LICENSE.");
  }
  expectPinnedParserOnly(readPacked(tarball, "package/package.json"));
};
