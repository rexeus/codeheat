// Builds throwaway git repositories for CLI journeys, isolated from the host's git config.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { Effect } from "effect";

const isolatedEnv = (date: string): NodeJS.ProcessEnv => ({
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_DATE: date,
  GIT_COMMITTER_DATE: date,
});

export type GitRepository = {
  readonly root: string;
  /** Writes `files` and commits them at `daysAgo` days before now. */
  readonly commit: (daysAgo: number, files: Record<string, string>) => void;
};

/** A temporary directory, removed when the scope closes. */
export const makeTempDirectory = Effect.acquireRelease(
  Effect.sync(() => mkdtempSync(join(tmpdir(), "codeheat-cli-"))),
  (directory) =>
    Effect.sync(() => {
      rmSync(directory, { force: true, recursive: true });
    }),
);

/** An initialized repository in a temporary directory, removed when the scope closes. */
export const makeGitRepository = Effect.map(
  makeTempDirectory,
  (root): GitRepository => {
    const git = (args: ReadonlyArray<string>, date: string) =>
      execFileSync("git", ["-C", root, ...args], {
        env: isolatedEnv(date),
        stdio: "ignore",
      });
    const now = new Date().toISOString();
    git(["init", "--quiet", "--initial-branch=main"], now);
    git(["config", "user.name", "Journey"], now);
    git(["config", "user.email", "journey@example.invalid"], now);
    return {
      root,
      commit: (daysAgo, files) => {
        const date = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
        for (const [path, content] of Object.entries(files)) {
          mkdirSync(dirname(join(root, path)), { recursive: true });
          writeFileSync(join(root, path), content);
        }
        git(["add", "--all"], date);
        git(["commit", "--quiet", "-m", `change ${daysAgo}`], date);
      },
    };
  },
);
