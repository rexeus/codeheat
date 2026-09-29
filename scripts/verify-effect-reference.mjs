import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  gitInReference,
  projectRoot,
  reference,
  referenceExists,
  tag,
} from "./effect-reference.mjs";

/** @type {Array<string>} */
const failures = [];

const expectedPackages = ["effect", "@effect/platform-node", "@effect/vitest"];

/** @param {unknown} value @returns {value is {version?: unknown}} */
const hasVersion = (value) =>
  typeof value === "object" && value !== null && "version" in value;

/** @param {string} failure @param {() => string} read @returns {string | undefined} */
const probe = (failure, read) => {
  try {
    return read();
  } catch {
    failures.push(failure);
    return undefined;
  }
};

for (const packageName of expectedPackages) {
  try {
    /** @type {unknown} */
    const packageJson = JSON.parse(
      readFileSync(
        join(projectRoot, "node_modules", packageName, "package.json"),
        "utf8",
      ),
    );
    if (!hasVersion(packageJson) || packageJson.version !== reference.version) {
      failures.push(`${packageName} is not ${reference.version}`);
    }
  } catch {
    failures.push(`${packageName} is not installed at its pinned version`);
  }
}

if (!referenceExists()) {
  failures.push(`no git checkout at ${reference.directory}`);
} else {
  const head = probe("the checkout HEAD cannot be read", () =>
    gitInReference("rev-parse", "HEAD"),
  );
  if (head !== undefined && head !== reference.commit) {
    failures.push(`HEAD is ${head}, expected ${reference.commit}`);
  }

  const resolvedTag = probe(`${tag} is missing or unreadable`, () =>
    gitInReference("rev-parse", `${tag}^{commit}`),
  );
  if (resolvedTag !== undefined && resolvedTag !== reference.commit) {
    failures.push(
      `${tag} resolves to ${resolvedTag}, expected ${reference.commit}`,
    );
  }

  const remote = probe("origin remote is missing or unreadable", () =>
    gitInReference("remote", "get-url", "origin").replace(/\.git$/u, ""),
  );
  if (remote !== undefined && remote !== reference.remote) {
    failures.push(`origin is ${remote}, expected ${reference.remote}`);
  }

  const shallow = probe("the checkout shallow-state cannot be read", () =>
    gitInReference("rev-parse", "--is-shallow-repository"),
  );
  if (shallow !== undefined && shallow !== "true") {
    failures.push("the checkout is not shallow");
  }

  const status = probe("the checkout status cannot be read", () =>
    gitInReference("status", "--porcelain"),
  );
  if (status !== undefined && status !== "") {
    failures.push("the checkout has local changes");
  }
}

if (failures.length > 0) {
  console.error("Effect reference verification failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error('Run "pnpm install" to restore the pinned reference.');
  process.exit(1);
}

console.log(`Effect reference verified: ${tag} at ${reference.commit}`);
