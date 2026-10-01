import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { isolatedGitEnv } from "./git-environment.mjs";

export const projectRoot = resolve(
  process.env["EFFECT_REFERENCE_ROOT"] ?? process.cwd(),
);
const configuredDirectory = process.env["EFFECT_REFERENCE_DIRECTORY"];

/** The exact Effect release used by this repository and its source authority. */
export const reference = {
  version: "4.0.0-rc.118",
  commit: "ad61db80efd52637e2901c5ee56b9e0fb4e8ac48",
  remote: "https://github.com/Effect-TS/effect",
  directory:
    configuredDirectory !== undefined
      ? resolve(configuredDirectory)
      : join(projectRoot, ".repos/effect"),
};

export const tag = `effect@${reference.version}`;

/** @param {...string} args @returns {string} */
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    env: isolatedGitEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

/** @param {...string} args @returns {string} */
export const gitInReference = (...args) =>
  git("-C", reference.directory, ...args);

/** @param {...string} args */
export const gitVerbose = (...args) => {
  execFileSync("git", args, { env: isolatedGitEnv(), stdio: "inherit" });
};

/** @returns {boolean} */
export const referencePathExists = () => existsSync(reference.directory);

/** @returns {boolean} */
export const referenceExists = () => {
  try {
    gitInReference("rev-parse", "--git-dir");
    return true;
  } catch {
    return false;
  }
};
