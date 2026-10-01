// Proves the packed `codeheat` package works the way `npx codeheat` will run it:
// one bundled file whose only runtime dependency is the pinned oxc-parser,
// installable with npm and pnpm, loading that parser, and able to analyze a
// real git repository. Run after `pnpm --filter codeheat build`.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { isolatedGitEnv } from "./git-environment.mjs";

const repository = resolve(import.meta.dirname, "..");

/**
 * Reads one field of a JSON object without trusting its shape.
 * @param {string} json
 * @param {string} field
 * @returns {unknown}
 */
const fieldOf = (json, field) => {
  /** @type {unknown} */
  const value = JSON.parse(json);
  return typeof value === "object" && value !== null && field in value
    ? Object.getOwnPropertyDescriptor(value, field)?.value
    : undefined;
};

const expectedVersion = fieldOf(
  readFileSync(join(repository, "apps/cli/package.json"), "utf8"),
  "version",
);
if (typeof expectedVersion !== "string") {
  throw new TypeError("apps/cli/package.json does not declare a version.");
}
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const binName = process.platform === "win32" ? "codeheat.cmd" : "codeheat";
const temporary = mkdtempSync(join(tmpdir(), "codeheat-package-"));

/**
 * @param {string} command
 * @param {ReadonlyArray<string>} args
 * @param {string} [cwd]
 */
const run = (command, args, cwd = repository) => {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
};

/** Packs the CLI and returns the tarball path. */
const pack = () => {
  const destination = join(temporary, "pack");
  mkdirSync(destination);
  run(pnpm, [
    "--filter",
    "codeheat",
    "pack",
    "--pack-destination",
    destination,
  ]);
  const tarballs = readdirSync(destination).filter((name) =>
    name.endsWith(".tgz"),
  );
  if (tarballs.length !== 1 || tarballs[0] === undefined) {
    throw new Error(`Expected one package tarball, found ${tarballs.length}.`);
  }
  return join(destination, tarballs[0]);
};

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

/** @param {string} tarball */
const expectBundledArtifact = (tarball) => {
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
  const packedReadme = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/README.md"],
    { encoding: "utf8" },
  );
  const relativeLinks = packedReadme.match(
    /\]\((?!https?:|#|mailto:)[^)\s]+\)/gu,
  );
  if (relativeLinks !== null) {
    throw new Error(
      `The packed README has relative links: ${relativeLinks.join(", ")}`,
    );
  }
  // The build copies the repository LICENSE into apps/cli; the packed copy must match it.
  const packedLicense = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/LICENSE"],
    { encoding: "utf8" },
  );
  if (packedLicense !== readFileSync(join(repository, "LICENSE"), "utf8")) {
    throw new Error("The packed LICENSE differs from the repository LICENSE.");
  }
  const packed = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/package.json"],
    { encoding: "utf8" },
  );
  expectPinnedParserOnly(packed);
};

/** A tiny repository with two files that always change together and never import each other. */
const makeRepository = () => {
  const root = join(temporary, "repository");
  mkdirSync(root);
  const env = isolatedGitEnv({
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  });
  /** @param {string[]} args */
  const git = (...args) =>
    execFileSync("git", ["-C", root, ...args], { env, stdio: "ignore" });
  git("init", "--quiet");
  for (const round of [1, 2, 3]) {
    writeFileSync(join(root, "a.ts"), `if (a) {\n  run(${round});\n}\n`);
    writeFileSync(join(root, "b.ts"), `b(${round});\n`);
    git("add", "--all");
    git(
      "-c",
      "user.name=Pack",
      "-c",
      "user.email=pack@example.invalid",
      "commit",
      "--quiet",
      "-m",
      `round ${round}`,
    );
  }
  return root;
};

/**
 * @param {string} applicationRoot
 * @param {string} installer
 * @param {string} repositoryRoot
 */
const expectWorkingInstall = (applicationRoot, installer, repositoryRoot) => {
  const bin = join(applicationRoot, "node_modules", ".bin", binName);
  if (!existsSync(bin)) {
    throw new Error(
      `The package installed with ${installer} exposes no codeheat executable.`,
    );
  }
  const version = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (version.stdout.trim() !== `codeheat v${expectedVersion}`) {
    throw new Error(
      `codeheat from ${installer} reports:\n${version.stdout}${version.stderr}`,
    );
  }
  const analysis = spawnSync(bin, ["analyze", "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const json = analysis.status === 0 ? analysis.stdout : "{}";
  const couplings = fieldOf(json, "couplings");
  if (
    fieldOf(json, "schemaVersion") !== 1 ||
    !Array.isArray(couplings) ||
    couplings.length !== 1
  ) {
    throw new Error(
      `codeheat from ${installer} did not analyze the repository:\n${analysis.stdout}${analysis.stderr}`,
    );
  }
  // `none` instead of null proves that the installed package loaded oxc-parser and parsed both files.
  if (fieldOf(JSON.stringify(couplings[0]), "imports") !== "none") {
    throw new Error(
      `codeheat from ${installer} could not read imports; is oxc-parser installed with its native binding?\n${analysis.stderr}`,
    );
  }
};

try {
  const tarball = pack();
  expectBundledArtifact(tarball);
  const repositoryRoot = makeRepository();

  const pnpmApplication = join(temporary, "application-pnpm");
  mkdirSync(pnpmApplication);
  writeFileSync(
    join(pnpmApplication, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  run(pnpm, ["add", "--ignore-scripts", tarball], pnpmApplication);
  expectWorkingInstall(pnpmApplication, "pnpm", repositoryRoot);

  // npm (and therefore npx) resolves dependencies differently from pnpm.
  const npmApplication = join(temporary, "application-npm");
  mkdirSync(npmApplication);
  writeFileSync(
    join(npmApplication, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  run(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    npmApplication,
  );
  if (existsSync(join(npmApplication, "node_modules", "effect"))) {
    throw new Error("npm installed effect; the bundle must not need it.");
  }
  if (!existsSync(join(npmApplication, "node_modules", "oxc-parser"))) {
    throw new Error("npm did not install the oxc-parser dependency.");
  }
  expectWorkingInstall(npmApplication, "npm", repositoryRoot);

  console.log(
    `Package verified: codeheat v${expectedVersion} installs and runs with pnpm and npm.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
