import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import {
  gitInReference,
  gitVerbose,
  reference,
  referenceExists,
  referencePathExists,
  tag,
} from "./effect-reference.mjs";

/** @param {string} reason @param {string} remedy @returns {never} */
const abort = (reason, remedy) => {
  console.error(`Effect reference not prepared: ${reason}`);
  console.error(remedy);
  process.exit(1);
};

const clone = () => {
  mkdirSync(dirname(reference.directory), { recursive: true });
  gitVerbose(
    "clone",
    "--depth=1",
    "--filter=blob:none",
    "--no-tags",
    reference.remote,
    reference.directory,
  );
};

/** @returns {boolean} */
const hasPinnedCommit = () => {
  try {
    gitInReference("cat-file", "-e", `${reference.commit}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

/** @returns {boolean} */
const hasPinnedTag = () => {
  try {
    gitInReference("rev-parse", `${tag}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

const fetchPinnedTag = () => {
  gitVerbose(
    "-C",
    reference.directory,
    "fetch",
    "--depth=1",
    "--filter=blob:none",
    "--no-tags",
    "origin",
    `refs/tags/${tag}:refs/tags/${tag}`,
  );
};

const assertTagMatchesPin = () => {
  const resolved = gitInReference("rev-parse", `${tag}^{commit}`);
  if (resolved !== reference.commit) {
    abort(
      `${tag} resolves to ${resolved}, but the pin expects ${reference.commit}`,
      "A published tag moved. Investigate upstream before trusting this source.",
    );
  }
};

const checkoutPinnedCommit = () => {
  if (gitInReference("rev-parse", "HEAD") !== reference.commit) {
    gitInReference("checkout", "--detach", reference.commit);
  }
};

if (referencePathExists() && !referenceExists()) {
  abort(
    `the path ${reference.directory} exists but is not a git checkout`,
    "Remove that path or restore it as the pinned Effect checkout before installing.",
  );
}

if (referenceExists() && gitInReference("status", "--porcelain") !== "") {
  abort(
    `the checkout at ${reference.directory} has local changes`,
    "Preserve or discard them before preparing the pinned reference.",
  );
}

try {
  if (!referenceExists()) {
    clone();
  }
  if (!hasPinnedCommit() || !hasPinnedTag()) {
    fetchPinnedTag();
  }
  assertTagMatchesPin();
  checkoutPinnedCommit();
} catch (error) {
  abort(
    error instanceof Error ? error.message : String(error),
    'Run "node scripts/prepare-effect.mjs" once network access is available.',
  );
}

console.log(`Effect reference ready: ${tag} at ${reference.directory}`);
