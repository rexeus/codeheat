import { execFileSync } from "node:child_process";

/**
 * The environment for a git process that must act on the directory it is
 * pointed at, not on the repository of a surrounding git hook or `git rebase -x`.
 * Drops every repository-local variable git itself lists.
 *
 * @param {NodeJS.ProcessEnv} [extra] variables added on top of the cleaned parent environment
 * @returns {NodeJS.ProcessEnv}
 */
export const isolatedGitEnv = (extra = {}) => {
  const localNames = execFileSync("git", ["rev-parse", "--local-env-vars"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((name) => name !== "");
  const env = { ...process.env, ...extra };
  for (const name of localNames) {
    delete env[name];
  }
  return env;
};
