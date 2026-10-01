import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { isolatedGitEnv } from "./git-environment.mjs";

const repositoryRoot = new URL("..", import.meta.url).pathname;
const fixtureRoots: string[] = [];

const runGit = (directory: string, ...args: string[]) => {
  execFileSync("git", ["-C", directory, ...args], {
    env: isolatedGitEnv(),
    stdio: "ignore",
  });
};

const createProject = (
  packageVersions: Partial<Record<string, string>> = {},
) => {
  const projectRoot = mkdtempSync(join(tmpdir(), "codeheat-effect-reference-"));
  fixtureRoots.push(projectRoot);
  for (const packageName of [
    "effect",
    "@effect/platform-node",
    "@effect/vitest",
  ]) {
    const packageDirectory = join(projectRoot, "node_modules", packageName);
    mkdirSync(packageDirectory, { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({
        version: packageVersions[packageName] ?? "4.0.0-rc.118",
      }),
    );
  }
  return projectRoot;
};

const createCheckout = (projectRoot: string) => {
  const checkout = join(projectRoot, "effect");
  mkdirSync(checkout);
  runGit(checkout, "init", "--quiet");
  runGit(checkout, "config", "user.email", "tests@example.invalid");
  runGit(checkout, "config", "user.name", "Reference Tests");
  writeFileSync(join(checkout, "README.md"), "fixture\n");
  runGit(checkout, "add", "README.md");
  runGit(checkout, "commit", "--quiet", "-m", "fixture");
  return checkout;
};

const verify = (projectRoot: string, checkout: string) =>
  spawnSync(process.execPath, ["scripts/verify-effect-reference.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      EFFECT_REFERENCE_DIRECTORY: checkout,
      EFFECT_REFERENCE_ROOT: projectRoot,
    },
  });

afterEach(() => {
  vi.unstubAllEnvs();
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

describe("Effect reference verification", () => {
  it("reports a missing checkout without a Git stack trace", () => {
    const projectRoot = createProject();
    const result = verify(projectRoot, join(projectRoot, "missing"));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no git checkout");
    expect(result.stderr).not.toContain("at execFileSync");
  });

  it("reports a wrong package version from the configured project root", () => {
    const projectRoot = createProject({ effect: "4.0.0-rc.114" });
    const checkout = createCheckout(projectRoot);

    const result = verify(projectRoot, checkout);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("effect is not 4.0.0-rc.118");
  });

  it("reports a dirty checkout", () => {
    const projectRoot = createProject();
    const checkout = createCheckout(projectRoot);
    writeFileSync(join(checkout, "dirty.txt"), "changed\n");

    const result = verify(projectRoot, checkout);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("checkout has local changes");
  });

  it("reports a checkout at the wrong HEAD", () => {
    const projectRoot = createProject();
    const checkout = createCheckout(projectRoot);

    const result = verify(projectRoot, checkout);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("HEAD is");
    expect(result.stderr).toContain(
      "expected ad61db80efd52637e2901c5ee56b9e0fb4e8ac48",
    );
  });

  it("reports missing tag and origin as structured failures", () => {
    const projectRoot = createProject();
    const checkout = createCheckout(projectRoot);

    const result = verify(projectRoot, checkout);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "effect@4.0.0-rc.118 is missing or unreadable",
    );
    expect(result.stderr).toContain("origin remote is missing or unreadable");
    expect(result.stderr).not.toContain("Error: Command failed");
  });
});

describe("Effect reference verification inside a git hook", () => {
  it("ignores git variables inherited from a surrounding repository", () => {
    const projectRoot = createProject();
    const checkout = createCheckout(projectRoot);
    writeFileSync(join(checkout, "dirty.txt"), "changed\n");
    const sentinel = join(projectRoot, "sentinel");
    mkdirSync(sentinel);
    runGit(sentinel, "init", "--quiet");
    const configBefore = readFileSync(join(sentinel, ".git", "config"), "utf8");
    vi.stubEnv("GIT_DIR", join(sentinel, ".git"));
    vi.stubEnv("GIT_WORK_TREE", sentinel);

    const result = verify(projectRoot, checkout);

    expect(result.stderr).toContain("checkout has local changes");
    expect(readFileSync(join(sentinel, ".git", "config"), "utf8")).toBe(
      configBefore,
    );
  });
});
