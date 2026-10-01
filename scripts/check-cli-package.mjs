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
import { expectBundledArtifact, fieldOf } from "./lib/packed-package.mjs";

const repository = resolve(import.meta.dirname, "..");

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

/** A tiny repository with two files that always change together and never import each other, and an `index.ts` that makes the one module export a single name over four lines of implementation. */
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
    writeFileSync(join(root, "index.ts"), "export const entry = 1;\n");
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
  // The same parser reads the exports behind the module's depth.
  const modules = fieldOf(json, "modules");
  const depth = Array.isArray(modules)
    ? JSON.stringify(fieldOf(JSON.stringify(modules[0]), "depth"))
    : undefined;
  if (depth !== '{"exports":1,"implementationLines":4,"linesPerExport":4}') {
    throw new Error(
      `codeheat from ${installer} reports the module depth ${depth}, not one export over four lines.\n${analysis.stdout}`,
    );
  }
};

/**
 * Without the parser's native binding (`npm install --omit=optional`), codeheat
 * still analyzes: it exits 0, says once on stderr that the parser is
 * unavailable, and reports `imports: null` and `depth: null` on every module.
 * @param {string} applicationRoot
 * @param {string} repositoryRoot
 */
const expectDegradedRun = (applicationRoot, repositoryRoot) => {
  const bin = join(applicationRoot, "node_modules", ".bin", binName);
  const analysis = spawnSync(bin, ["analyze", "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const couplings = fieldOf(
    analysis.status === 0 ? analysis.stdout : "{}",
    "couplings",
  );
  const modules = fieldOf(
    analysis.status === 0 ? analysis.stdout : "{}",
    "modules",
  );
  const notes = analysis.stderr.trim().split("\n");
  if (
    !Array.isArray(couplings) ||
    couplings.length !== 1 ||
    fieldOf(JSON.stringify(couplings[0]), "imports") !== null ||
    !Array.isArray(modules) ||
    modules.length === 0 ||
    !modules.every(
      (module) => fieldOf(JSON.stringify(module), "depth") === null,
    ) ||
    notes.length !== 1 ||
    !(notes[0] ?? "").startsWith("codeheat: the code parser is unavailable")
  ) {
    throw new Error(
      `codeheat without the parser binding did not degrade gracefully (exit ${analysis.status}):\n${analysis.stdout}${analysis.stderr}`,
    );
  }
};

/**
 * @param {string} name
 * @param {ReadonlyArray<string>} extraArguments
 * @param {string} tarball
 */
const installWithNpm = (name, extraArguments, tarball) => {
  const application = join(temporary, name);
  mkdirSync(application);
  writeFileSync(
    join(application, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  run(
    npm,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...extraArguments,
      tarball,
    ],
    application,
  );
  return application;
};

try {
  const tarball = pack();
  expectBundledArtifact(tarball, repository);
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
  const npmApplication = installWithNpm("application-npm", [], tarball);
  if (existsSync(join(npmApplication, "node_modules", "effect"))) {
    throw new Error("npm installed effect; the bundle must not need it.");
  }
  if (!existsSync(join(npmApplication, "node_modules", "oxc-parser"))) {
    throw new Error("npm did not install the oxc-parser dependency.");
  }
  expectWorkingInstall(npmApplication, "npm", repositoryRoot);

  expectDegradedRun(
    installWithNpm("application-without-binding", ["--omit=optional"], tarball),
    repositoryRoot,
  );

  console.log(
    `Package verified: codeheat v${expectedVersion} installs and runs with pnpm and npm, and degrades without the parser binding.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
